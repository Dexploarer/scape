import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

import { type AgentScriptSpec, validateAgentScriptSpec } from "../../agent";
import type { ControlPlaneClient } from "../../controlplane/ControlPlaneClient";
import type { GameEventBus } from "../../game/events/GameEventBus";
import type { PlayerManager } from "../../game/PlayerManager";
import type { PlayerState } from "../../game/player";
import { nowMicros } from "../../game/state/SpacetimeStateIds";
import type { PersistenceProvider } from "../../game/state/PersistenceProvider";
import type { ServerServices } from "../../game/ServerServices";
import { logger } from "../../utils/logger";
import { safeJsonStringify } from "../../utils/safeJsonStringify";

import { AgentPlayerFactory } from "./AgentPlayerFactory";
import {
    BotSdkActionRouter,
    type ActionDispatchResult,
} from "./BotSdkActionRouter";
import {
    decodeClientFrame,
    encodeServerFrame,
    guessClientFrameFormat,
    type BotSdkWireFormat,
} from "./BotSdkCodec";
import { BotSdkEventBridge } from "./BotSdkEventBridge";
import { BotSdkPerceptionEmitter } from "./BotSdkPerceptionEmitter";
import { BotSdkPerceptionBuilder } from "./BotSdkPerceptionBuilder";
import {
    BotSdkProposalRegistry,
    type BotSdkScriptProposalRecord,
} from "./BotSdkProposalRegistry";
import { BotSdkRecentEventStore } from "./BotSdkRecentEventStore";
import { BotSdkScriptController } from "./BotSdkScriptController";
import {
    BotSdkTrajectoryRecorder,
    JsonlBotSdkTrajectorySink,
} from "./BotSdkTrajectoryRecorder";
import type {
    AnyActionFrame,
    BotSdkFeature,
    ClientFrame,
    ProposalDecisionFrame,
    RuntimeEventFrame,
    ScriptFrame,
    ScriptProposalFrame,
    ServerFrame,
    SpawnFrame,
} from "./BotSdkProtocol";

export interface BotSdkServerOptions {
    host: string;
    port: number;
    token: string;
    serverName?: string;
    perceptionEveryNTicks?: number;
    standalone?: boolean;
    worldId?: string;
    trajectoryLogPath?: string;
}

export interface BotSdkServerDeps {
    factory: AgentPlayerFactory;
    router: BotSdkActionRouter;
    services?: () => ServerServices;
    recorder?: BotSdkTrajectoryRecorder;
    controlPlane?: ControlPlaneClient;
    worldId?: string;
    eventBus?: GameEventBus;
    players?: () => PlayerManager | undefined;
    hookTicker: (cb: (tick: number) => void) => void;
    playerPersistence: PersistenceProvider;
}

interface AgentSession {
    ws: WebSocket;
    player: PlayerState;
    authedAt: number;
    saveKey: string;
    features: Set<BotSdkFeature>;
    wireFormat?: BotSdkWireFormat;
}

interface BotSdkSocketState {
    authed: boolean;
    session?: AgentSession;
    features: Set<BotSdkFeature>;
    wireFormat?: BotSdkWireFormat;
}

const PROTOCOL_VERSION = 1;
const MAX_JOURNAL_ENTRIES = 24;

export interface BotSdkScriptBroadcastResult {
    matched: number;
    delivered: number;
    failed: number;
    failureMessages: string[];
}

export interface BotSdkJournalActivityRecord {
    id: string;
    kind: "proposal" | "decision" | "control";
    text: string;
    timestamp: number;
    playerId?: number;
    proposalId?: string;
}

export interface BotSdkJournalSnapshot {
    proposals: BotSdkScriptProposalRecord[];
    activities: BotSdkJournalActivityRecord[];
}

export interface BotSdkProposalDecisionResult {
    ok: boolean;
    message: string;
    proposal?: BotSdkScriptProposalRecord;
}

export class BotSdkServer {
    private wss: WebSocketServer | null = null;
    private readonly sessions = new Map<WebSocket, AgentSession>();
    private readonly proposalRegistry = new BotSdkProposalRegistry();
    private readonly journalActivity: BotSdkJournalActivityRecord[] = [];
    private readonly scriptController: BotSdkScriptController;
    private emitter: BotSdkPerceptionEmitter | null = null;
    private recentEvents: BotSdkRecentEventStore | null = null;
    private eventBridge: BotSdkEventBridge | null = null;
    private trajectoryRecorder: BotSdkTrajectoryRecorder | null = null;
    private journalWriteChain: Promise<void> = Promise.resolve();
    private nextJournalSerial = 0;

    constructor(
        private readonly options: BotSdkServerOptions,
        private readonly deps: BotSdkServerDeps,
    ) {
        this.scriptController = new BotSdkScriptController({
            router: deps.router,
            recorder: {
                recordActionDispatch: (player, frame) =>
                    this.getRecorder()?.recordActionDispatch(player, frame),
                recordActionResult: (player, frame, dispatch) =>
                    this.getRecorder()?.recordActionResult(player, frame, dispatch),
            } as BotSdkTrajectoryRecorder,
            emitEvent: (player, frame) => this.emitRuntimeEvent(player, frame),
        });
    }

    start(): void {
        if (!this.options.token || this.options.token.length === 0) {
            logger.info(
                "[botsdk] disabled — BOT_SDK_TOKEN not set. Agents cannot connect.",
            );
            return;
        }

        if (this.options.standalone) {
            this.wss = new WebSocketServer({
                host: this.options.host,
                port: this.options.port,
            });
            this.wss.on("listening", () => {
                logger.info(
                    `[botsdk] (standalone) listening on ws://${this.options.host}:${this.options.port} (token=set)`,
                );
            });
        } else {
            this.wss = new WebSocketServer({ noServer: true });
            logger.info("[botsdk] attached to main HTTP server at path /botsdk (token=set)");
        }

        this.wss.on("error", (err) => {
            logger.error("[botsdk] server error:", err);
        });
        this.wss.on("connection", (ws) => this.handleConnection(ws));

        this.trajectoryRecorder = this.deps.recorder ?? this.createTrajectoryRecorder();

        if (this.deps.services) {
            this.recentEvents = new BotSdkRecentEventStore({
                services: this.deps.services,
            });
            const builder = new BotSdkPerceptionBuilder({
                services: this.deps.services,
                recentEvents: this.recentEvents,
            });
            this.emitter = new BotSdkPerceptionEmitter(
                () => this.iterAgentPlayers(),
                (player, snapshot) => {
                    const session = this.findSessionByPlayer(player);
                    if (!session) return;
                    this.sendFrame(session.ws, {
                        kind: "perception",
                        snapshot,
                    });
                    this.getRecorder()?.recordPerception(player, snapshot);
                },
                builder,
                { everyNTicks: this.options.perceptionEveryNTicks },
            );
        }

        const services = this.deps.services;
        const eventBus =
            this.deps.eventBus ??
            (services ? services().eventBus : undefined);
        const resolvePlayers =
            this.deps.players ??
            (services ? () => services().players : undefined);
        if (eventBus && resolvePlayers) {
            const playerResolver = resolvePlayers;
            this.eventBridge = new BotSdkEventBridge({
                eventBus,
                resolvePlayerById: (playerId) => playerResolver()?.getById(playerId),
                sink: (player, frame) => this.handleRuntimeEvent(player, frame),
            });
        }

        this.deps.hookTicker((tick) => this.handleTick(tick));
    }

    canAcceptUpgrade(): boolean {
        return this.wss !== null && !this.options.standalone;
    }

    handleUpgrade(
        req: IncomingMessage,
        socket: Duplex,
        head: Buffer,
    ): void {
        if (!this.wss) {
            try {
                socket.write(
                    "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
                );
                socket.destroy();
            } catch {}
            return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss!.emit("connection", ws, req);
        });
    }

    stop(): void {
        for (const session of this.sessions.values()) {
            try {
                session.ws.close(1001, "server_shutdown");
            } catch {}
        }
        this.sessions.clear();
        this.eventBridge?.dispose();
        this.eventBridge = null;
        this.recentEvents?.dispose();
        this.recentEvents = null;
        this.wss?.close();
        this.wss = null;
        void this.trajectoryRecorder?.dispose();
        this.trajectoryRecorder = null;
        this.emitter = null;
    }

    broadcastOperatorCommand(
        source: "chat" | "admin",
        text: string,
        fromPlayerId?: number,
        fromPlayerName?: string,
    ): number {
        if (this.sessions.size === 0) return 0;
        const frame = {
            kind: "operatorCommand" as const,
            source,
            text: text.trim(),
            timestamp: Date.now(),
            fromPlayerId,
            fromPlayerName,
        };
        let count = 0;
        for (const session of this.sessions.values()) {
            this.sendFrame(session.ws, frame);
            this.getRecorder()?.recordOperatorCommand(session.player, frame);
            this.scriptController.onOperatorCommand(session.player, frame);
            count += 1;
        }
        if (count > 0) {
            logger.info(
                `[botsdk] broadcast operator command → ${count} agent(s) source=${source} text="${frame.text.slice(0, 60)}"`,
            );
        }
        return count;
    }

    broadcastInstallScript(
        spec: AgentScriptSpec,
        targetAgentId?: string,
        targetPlayerId?: number,
    ): BotSdkScriptBroadcastResult {
        const result = this.controlScripts(
            (player) => this.scriptController.install(player, spec),
            targetAgentId,
            targetPlayerId,
        );
        if (result.matched > 0 || result.failureMessages[0]) {
            this.recordJournalActivity({
                kind: "control",
                playerId: targetPlayerId,
                text:
                    result.delivered > 0
                        ? `Installed script ${spec.scriptId} on ${result.delivered} agent${result.delivered === 1 ? "" : "s"}.`
                        : result.failureMessages[0] ?? `No agents accepted script ${spec.scriptId}.`,
            });
            this.recordJournalLiveEvent(
                targetPlayerId !== undefined
                    ? this.findSessionByPlayerId(targetPlayerId)?.player
                    : undefined,
                "journal:scriptControl",
                {
                    operation: "install",
                    scriptId: spec.scriptId,
                    targetAgentId,
                    targetPlayerId,
                    matched: result.matched,
                    delivered: result.delivered,
                    failureMessages: result.failureMessages,
                },
            );
        }
        return result;
    }

    broadcastClearScript(
        reason?: string,
        targetAgentId?: string,
        targetPlayerId?: number,
    ): BotSdkScriptBroadcastResult {
        const result = this.controlScripts(
            (player) => this.scriptController.clear(player, reason),
            targetAgentId,
            targetPlayerId,
        );
        if (result.matched > 0 || result.failureMessages[0]) {
            this.recordJournalActivity({
                kind: "control",
                playerId: targetPlayerId,
                text:
                    result.delivered > 0
                        ? `Cleared scripts on ${result.delivered} agent${result.delivered === 1 ? "" : "s"}.`
                        : result.failureMessages[0] ?? "No active scripts were cleared.",
            });
            this.recordJournalLiveEvent(
                targetPlayerId !== undefined
                    ? this.findSessionByPlayerId(targetPlayerId)?.player
                    : undefined,
                "journal:scriptControl",
                {
                    operation: "clear",
                    reason,
                    targetAgentId,
                    targetPlayerId,
                    matched: result.matched,
                    delivered: result.delivered,
                    failureMessages: result.failureMessages,
                },
            );
        }
        return result;
    }

    broadcastInterruptScript(
        interrupt: string,
        reason?: string,
        targetAgentId?: string,
        targetPlayerId?: number,
    ): BotSdkScriptBroadcastResult {
        const result = this.controlScripts(
            (player) => this.scriptController.interrupt(player, interrupt, reason),
            targetAgentId,
            targetPlayerId,
        );
        if (result.matched > 0 || result.failureMessages[0]) {
            this.recordJournalActivity({
                kind: "control",
                playerId: targetPlayerId,
                text:
                    result.delivered > 0
                        ? `Interrupted ${result.delivered} agent${result.delivered === 1 ? "" : "s"} with ${interrupt}.`
                        : result.failureMessages[0] ?? `No agents handled interrupt ${interrupt}.`,
            });
            this.recordJournalLiveEvent(
                targetPlayerId !== undefined
                    ? this.findSessionByPlayerId(targetPlayerId)?.player
                    : undefined,
                "journal:scriptControl",
                {
                    operation: "interrupt",
                    interrupt,
                    reason,
                    targetAgentId,
                    targetPlayerId,
                    matched: result.matched,
                    delivered: result.delivered,
                    failureMessages: result.failureMessages,
                },
            );
        }
        return result;
    }

    getJournalSnapshot(targetPlayerId?: number): BotSdkJournalSnapshot {
        return {
            proposals: this.proposalRegistry.list(targetPlayerId),
            activities: this.journalActivity
                .filter((entry) =>
                    targetPlayerId === undefined
                        ? true
                        : entry.playerId === undefined || (entry.playerId | 0) === (targetPlayerId | 0),
                )
                .slice(),
        };
    }

    decideScriptProposal(
        proposalId: string,
        decision: "approve_install" | "reject",
        message?: string,
    ): BotSdkProposalDecisionResult {
        const proposal = this.proposalRegistry.get(proposalId);
        if (!proposal) {
            return {
                ok: false,
                message: `Unknown script proposal ${proposalId}.`,
            };
        }

        if (decision === "reject") {
            this.proposalRegistry.remove(proposalId);
            this.sendProposalDecision(proposal.playerId, {
                kind: "proposalDecision",
                proposalId,
                decision: "rejected",
                message,
            });
            this.recordJournalActivity({
                kind: "decision",
                playerId: proposal.playerId,
                proposalId,
                text: `Rejected proposal ${proposal.script.scriptId}${proposal.displayName ? ` from ${proposal.displayName}` : ""}.`,
            });
            this.recordJournalLiveEvent(
                this.findPlayerForProposal(proposal),
                "journal:scriptProposalDecision",
                {
                    proposalId,
                    decision: "rejected",
                    message,
                    scriptId: proposal.script.scriptId,
                    agentId: proposal.agentId,
                },
            );
            return {
                ok: true,
                message: `Rejected proposal ${proposal.script.scriptId}.`,
                proposal,
            };
        }

        const player = this.findPlayerForProposal(proposal);
        if (!player) {
            return {
                ok: false,
                message: `Agent ${proposal.displayName} is not connected.`,
                proposal,
            };
        }

        const install = this.scriptController.install(player, proposal.script);
        if (!install.ok) {
            this.recordJournalActivity({
                kind: "decision",
                playerId: proposal.playerId,
                proposalId,
                text: `Failed to install proposal ${proposal.script.scriptId}: ${install.message}`,
            });
            return {
                ok: false,
                message: install.message,
                proposal,
            };
        }

        this.proposalRegistry.remove(proposalId);
        this.sendProposalDecision(proposal.playerId, {
            kind: "proposalDecision",
            proposalId,
            decision: "approved",
            installed: true,
            message: message ?? install.message,
        });
        this.recordJournalActivity({
            kind: "decision",
            playerId: proposal.playerId,
            proposalId,
            text: `Approved and installed proposal ${proposal.script.scriptId}${proposal.displayName ? ` from ${proposal.displayName}` : ""}.`,
        });
        this.recordJournalLiveEvent(player, "journal:scriptProposalDecision", {
            proposalId,
            decision: "approved",
            installed: true,
            message: message ?? install.message,
            scriptId: proposal.script.scriptId,
            agentId: proposal.agentId,
        });
        return {
            ok: true,
            message: `Approved and installed proposal ${proposal.script.scriptId}.`,
            proposal,
        };
    }

    private createTrajectoryRecorder(): BotSdkTrajectoryRecorder | null {
        const worldId = this.resolveWorldId();
        if (!worldId) {
            return null;
        }
        const sink = this.options.trajectoryLogPath?.trim()
            ? new JsonlBotSdkTrajectorySink(this.options.trajectoryLogPath.trim())
            : undefined;
        if (!sink && !this.deps.controlPlane) {
            return null;
        }
        return new BotSdkTrajectoryRecorder({
            worldId,
            controlPlane: this.deps.controlPlane,
            sink,
        });
    }

    private handleConnection(ws: WebSocket): void {
        const state: BotSdkSocketState = {
            authed: false,
            features: new Set<BotSdkFeature>(),
        };

        ws.on("message", (data) => {
            const text =
                typeof data === "string"
                    ? data
                    : Buffer.isBuffer(data)
                        ? data.toString("utf-8")
                        : Buffer.from(data as ArrayBuffer).toString("utf-8");
            this.handleMessage(ws, state, text);
        });

        ws.on("close", (code, reasonBuffer) => {
            const existing = this.sessions.get(ws);
            if (!existing) {
                return;
            }

            const reason =
                typeof reasonBuffer === "string"
                    ? reasonBuffer
                    : reasonBuffer.length > 0
                        ? reasonBuffer.toString("utf-8")
                        : undefined;

            try {
                this.deps.playerPersistence.saveSnapshot(
                    existing.saveKey,
                    existing.player,
                );
            } catch (error) {
                logger.warn(
                    `[botsdk] failed to save state for agent ${existing.player.agent?.identity.agentId}`,
                    error,
                );
            }

            try {
                this.deps.factory.markDisconnected(existing.player);
            } catch (error) {
                logger.warn(
                    `[botsdk] failed to mark agent ${existing.player.id} disconnected`,
                    error,
                );
            }

            try {
                this.deps.factory.destroy(existing.player);
            } catch (error) {
                logger.warn(
                    `[botsdk] failed to destroy agent player ${existing.player.id}`,
                    error,
                );
            }

            this.getRecorder()?.recordDisconnect(
                existing.player,
                reason ?? `ws_close:${code}`,
            );
            this.proposalRegistry.removeByPlayerId(existing.player.id);
            this.sessions.delete(ws);
        });

        ws.on("error", (err) => {
            logger.warn("[botsdk] socket error:", err);
        });
    }

    private handleMessage(
        ws: WebSocket,
        state: BotSdkSocketState,
        raw: string,
    ): void {
        const decoded = decodeClientFrame(raw);
        if (!decoded.ok) {
            this.sendError(
                ws,
                "bad_frame",
                decoded.error,
                state.wireFormat ?? guessClientFrameFormat(raw),
            );
            return;
        }
        if (state.wireFormat && decoded.value.format !== state.wireFormat) {
            this.sendError(
                ws,
                "mixed_frame_formats",
                "switching between JSON and TOON on one socket is not supported.",
                state.wireFormat,
            );
            ws.close(1008, "mixed_frame_formats");
            return;
        }
        state.wireFormat ??= decoded.value.format;
        const frame: ClientFrame = decoded.value.frame;

        if (!state.authed) {
            if (frame.kind !== "auth") {
                this.sendError(
                    ws,
                    "unauth",
                    "first frame must be `auth`",
                    state.wireFormat,
                );
                ws.close(1008, "unauth");
                return;
            }
            if (frame.token !== this.options.token) {
                this.sendError(
                    ws,
                    "bad_token",
                    "BOT_SDK_TOKEN mismatch",
                    state.wireFormat,
                );
                ws.close(1008, "bad_token");
                return;
            }
            state.features = new Set(
                (frame.features ?? []).filter((value) => this.isKnownFeature(value)),
            );
            state.authed = true;
            const supportedFeatures: BotSdkFeature[] = ["liveEvents"];
            if (this.deps.services?.().hostedSessionService?.isEnabled()) {
                supportedFeatures.unshift("hostedSessions");
            }
            this.sendFrame(ws, {
                kind: "authOk",
                server: this.options.serverName ?? "xrsps",
                version: PROTOCOL_VERSION,
                features: supportedFeatures,
            }, state.wireFormat);
            return;
        }

        switch (frame.kind) {
            case "auth":
                return;
            case "spawn":
                void this.handleSpawn(ws, state, frame).catch((error) => {
                    logger.error("[botsdk] spawn failed", error);
                    this.sendError(
                        ws,
                        "spawn_failed",
                        "Failed to spawn agent.",
                        state.wireFormat,
                    );
                });
                return;
            case "action":
                this.handleAction(ws, state, frame);
                return;
            case "script":
                this.handleScript(ws, state, frame);
                return;
            case "proposal":
                this.handleProposal(ws, state, frame);
                return;
            case "disconnect":
                ws.close(1000, frame.reason ?? "client_disconnect");
                return;
        }
    }

    private async handleSpawn(
        ws: WebSocket,
        state: BotSdkSocketState,
        frame: SpawnFrame,
    ): Promise<void> {
        if (state.session) {
            this.sendError(
                ws,
                "already_spawned",
                `agent ${state.session.player.agent?.identity.agentId} already owns this socket`,
                state.session.wireFormat,
            );
            return;
        }

        const worldId = this.resolveWorldId();
        if (frame.worldId && worldId && frame.worldId !== worldId) {
            this.sendError(
                ws,
                "bad_world",
                `spawn worldId="${frame.worldId}" does not match server world "${worldId}"`,
                state.wireFormat,
            );
            return;
        }

        const result = await Promise.resolve(
            this.deps.factory.spawn({
                agentId: frame.agentId,
                displayName: frame.displayName,
                password: frame.password,
                sessionToken: frame.sessionToken,
                worldCharacterId: frame.worldCharacterId,
                controller: frame.controller ?? "hybrid",
                persona: frame.persona,
            }),
        );
        if (!result.ok) {
            this.sendError(ws, result.code, result.message, state.wireFormat);
            return;
        }

        const session: AgentSession = {
            ws,
            player: result.player,
            authedAt: Date.now(),
            saveKey: result.saveKey,
            features: new Set(state.features),
            wireFormat: state.wireFormat ?? "toon",
        };
        state.session = session;
        this.sessions.set(ws, session);
        this.getRecorder()?.recordSpawn(result.player, result.saveKey);

        this.sendFrame(ws, {
            kind: "spawnOk",
            playerId: result.player.id,
            x: result.player.tileX,
            z: result.player.tileY,
            level: result.player.level,
        });
    }

    private handleAction(
        ws: WebSocket,
        state: BotSdkSocketState,
        frame: AnyActionFrame,
    ): void {
        if (!state.session) {
            this.sendError(
                ws,
                "not_spawned",
                "must send `spawn` frame before `action`",
                state.wireFormat,
            );
            return;
        }

        this.getRecorder()?.recordActionDispatch(state.session.player, frame);
        const dispatch: ActionDispatchResult = this.deps.router.dispatch(
            state.session.player.id,
            frame,
        );
        this.getRecorder()?.recordActionResult(state.session.player, frame, dispatch);

        if (frame.correlationId) {
            this.sendFrame(ws, {
                kind: "ack",
                correlationId: frame.correlationId,
                success: dispatch.success,
                message: dispatch.message,
            });
        }
    }

    private handleScript(
        ws: WebSocket,
        state: BotSdkSocketState,
        frame: ScriptFrame,
    ): void {
        const fail = (code: string, message: string) => {
            if (frame.correlationId) {
                this.sendFrame(ws, {
                    kind: "ack",
                    correlationId: frame.correlationId,
                    success: false,
                    message,
                });
                return;
            }
            this.sendError(ws, code, message, state.session?.wireFormat ?? state.wireFormat);
        };

        if (!state.session) {
            fail("not_spawned", "must send `spawn` frame before `script`");
            return;
        }

        let result;
        switch (frame.operation) {
            case "install":
                result = this.scriptController.install(state.session.player, frame.script);
                break;
            case "clear":
                result = this.scriptController.clear(state.session.player, frame.reason);
                break;
            case "interrupt":
                result = this.scriptController.interrupt(
                    state.session.player,
                    frame.interrupt,
                    frame.reason,
                );
                break;
        }

        if (!result.ok) {
            fail("script_control_failed", result.message);
            return;
        }

        if (frame.correlationId) {
            this.sendFrame(ws, {
                kind: "ack",
                correlationId: frame.correlationId,
                success: true,
                message: result.message,
            });
        }
    }

    private handleProposal(
        ws: WebSocket,
        state: BotSdkSocketState,
        frame: ScriptProposalFrame,
    ): void {
        const fail = (code: string, message: string) => {
            if (frame.correlationId) {
                this.sendFrame(ws, {
                    kind: "ack",
                    correlationId: frame.correlationId,
                    success: false,
                    message,
                });
                return;
            }
            this.sendError(ws, code, message, state.session?.wireFormat ?? state.wireFormat);
        };

        if (!state.session) {
            fail("not_spawned", "must send `spawn` frame before `proposal`");
            return;
        }

        const validation = validateAgentScriptSpec(frame.script);
        if (!validation.ok) {
            fail("proposal_invalid", validation.error);
            return;
        }

        const proposalId =
            frame.proposalId?.trim() ||
            `${state.session.player.id}:${frame.script.scriptId}:${Date.now()}`;
        const proposal: BotSdkScriptProposalRecord = {
            proposalId,
            playerId: state.session.player.id,
            agentId:
                state.session.player.agent?.identity.agentId ??
                `player-${state.session.player.id}`,
            displayName: state.session.player.name ?? "Unknown agent",
            principalId: state.session.player.__principalId,
            worldCharacterId: state.session.player.__worldCharacterId,
            summary: frame.summary?.trim() || frame.script.goal || frame.script.name,
            script: frame.script,
            proposedAt: Date.now(),
        };

        this.proposalRegistry.upsert(proposal);
        this.recordJournalActivity({
            kind: "proposal",
            playerId: proposal.playerId,
            proposalId,
            text: `Queued proposal ${proposal.script.scriptId}${proposal.displayName ? ` from ${proposal.displayName}` : ""}.`,
        });
        this.recordJournalLiveEvent(state.session.player, "journal:scriptProposal", {
            proposalId,
            scriptId: proposal.script.scriptId,
            summary: proposal.summary,
            agentId: proposal.agentId,
        });
        this.emitRuntimeEvent(state.session.player, {
            kind: "event",
            name: "script:proposalQueued",
            timestamp: Date.now(),
            payload: {
                proposalId,
                scriptId: proposal.script.scriptId,
                summary: proposal.summary,
            },
        });

        if (frame.correlationId) {
            this.sendFrame(ws, {
                kind: "ack",
                correlationId: frame.correlationId,
                success: true,
                message: `queued proposal ${proposal.script.scriptId}`,
            });
        }
    }

    private handleTick(tick: number): void {
        this.emitter?.onTick(tick);
        for (const player of this.iterAgentPlayers()) {
            this.scriptController.onTick(player);
        }
    }

    private handleRuntimeEvent(player: PlayerState, frame: RuntimeEventFrame): void {
        this.emitRuntimeEvent(player, frame);
        this.scriptController.onRuntimeEvent(player, frame);
    }

    private emitRuntimeEvent(player: PlayerState, frame: RuntimeEventFrame): void {
        const session = this.findSessionByPlayer(player);
        if (!session) return;
        if (this.canDeliverRuntimeEvents(session)) {
            this.sendFrame(session.ws, frame);
        }
        this.getRecorder()?.recordRuntimeEvent(player, frame);
    }

    private controlScripts(
        apply: (player: PlayerState) => { ok: boolean; message: string },
        targetAgentId?: string,
        targetPlayerId?: number,
    ): BotSdkScriptBroadcastResult {
        const failureMessages: string[] = [];
        let matched = 0;
        let delivered = 0;

        for (const session of this.sessions.values()) {
            const agentId = session.player.agent?.identity.agentId;
            if (!session.player.agent?.connected) continue;
            if (targetAgentId && agentId !== targetAgentId) continue;
            if (targetPlayerId !== undefined && session.player.id !== targetPlayerId) continue;
            matched += 1;
            const result = apply(session.player);
            if (result.ok) {
                delivered += 1;
            } else {
                failureMessages.push(result.message);
            }
        }

        return {
            matched,
            delivered,
            failed: failureMessages.length,
            failureMessages,
        };
    }

    private canDeliverRuntimeEvents(
        session: AgentSession | (Omit<AgentSession, "features"> & { features?: Set<BotSdkFeature> }),
    ): boolean {
        return (
            !session.features ||
            session.features.size === 0 ||
            session.features.has("liveEvents")
        );
    }

    private isKnownFeature(value: string): value is BotSdkFeature {
        return value === "hostedSessions" || value === "liveEvents";
    }

    private sendFrame(
        ws: WebSocket,
        frame: ServerFrame,
        wireFormat?: BotSdkWireFormat,
    ): void {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
            ws.send(encodeServerFrame(frame, wireFormat ?? this.sessions.get(ws)?.wireFormat ?? "toon"));
        } catch (err) {
            logger.warn("[botsdk] failed to send frame:", err);
        }
    }

    private sendError(
        ws: WebSocket,
        code: string,
        message: string,
        wireFormat?: BotSdkWireFormat,
    ): void {
        this.sendFrame(ws, { kind: "error", code, message }, wireFormat);
    }

    private *iterAgentPlayers(): Iterable<PlayerState> {
        for (const session of this.sessions.values()) {
            if (session.player.agent?.connected) {
                yield session.player;
            }
        }
    }

    private findSessionByPlayer(player: PlayerState): AgentSession | undefined {
        for (const session of this.sessions.values()) {
            if (session.player.id === player.id) {
                return session;
            }
        }
        return undefined;
    }

    private findSessionByPlayerId(playerId: number): AgentSession | undefined {
        for (const session of this.sessions.values()) {
            if ((session.player.id | 0) === (playerId | 0)) {
                return session;
            }
        }
        return undefined;
    }

    private findPlayerForProposal(proposal: BotSdkScriptProposalRecord): PlayerState | undefined {
        return this.findSessionByPlayerId(proposal.playerId)?.player;
    }

    private sendProposalDecision(playerId: number, frame: ProposalDecisionFrame): void {
        const session = this.findSessionByPlayerId(playerId);
        if (!session) return;
        this.sendFrame(session.ws, frame);
    }

    private recordJournalActivity(
        entry: Omit<BotSdkJournalActivityRecord, "id" | "timestamp"> & {
            id?: string;
            timestamp?: number;
        },
    ): void {
        const timestamp = entry.timestamp ?? Date.now();
        const id = entry.id ?? `journal:${timestamp}:${++this.nextJournalSerial}`;
        this.journalActivity.unshift({
            id,
            kind: entry.kind,
            text: entry.text,
            timestamp,
            playerId: entry.playerId,
            proposalId: entry.proposalId,
        });
        if (this.journalActivity.length > MAX_JOURNAL_ENTRIES) {
            this.journalActivity.length = MAX_JOURNAL_ENTRIES;
        }
    }

    private recordJournalLiveEvent(
        player: PlayerState | undefined,
        eventName: string,
        payload: Record<string, unknown>,
    ): void {
        const worldId = this.resolveWorldId();
        if (!this.deps.controlPlane || !worldId) {
            return;
        }

        const recordedAt = nowMicros();
        const serial = ++this.nextJournalSerial;
        const payloadJson = safeJsonStringify(payload);
        this.journalWriteChain = this.journalWriteChain
            .then(async () => {
                await this.deps.controlPlane?.putLiveEvent?.({
                    event_id: `journal:${worldId}:${recordedAt.toString()}:${serial}`,
                    world_id: worldId,
                    principal_id: player?.__principalId,
                    world_character_id: player?.__worldCharacterId,
                    player_id: player?.id,
                    source: "botsdk_journal",
                    event_name: eventName,
                    payload_json: payloadJson,
                    recorded_at: recordedAt,
                });
            })
            .catch((error) => {
                logger.error(`[botsdk] failed to record ${eventName}`, error);
            });
    }

    private resolveWorldId(): string | undefined {
        return this.deps.worldId ?? this.options.worldId ?? this.deps.services?.().worldId;
    }

    private getRecorder(): BotSdkTrajectoryRecorder | undefined {
        return this.trajectoryRecorder ?? this.deps.recorder;
    }
}
