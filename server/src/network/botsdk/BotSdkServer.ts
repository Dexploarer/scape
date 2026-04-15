/**
 * BotSdkServer — the WebSocket endpoint agents connect to.
 *
 * Runs on its own port (default 43595) so it's physically separate from the
 * binary human-client protocol on 43594. Clients connect, authenticate with
 * `BOT_SDK_TOKEN`, send a `spawn` frame to create an agent-player, then
 * stream action frames for the rest of the session. The server pushes
 * perception snapshots back on a timer driven by {@link BotSdkPerceptionEmitter}.
 *
 * **Scope boundary**: the server is pure networking + frame routing. It does
 * NOT contain any game logic. All decisions about "what happens when an
 * agent walks" are delegated to the existing services via
 * {@link BotSdkActionRouter}.
 *
 * **Disabled by default**: if `BOT_SDK_TOKEN` is unset, the server refuses
 * to start. This means casual deployments that don't need agents don't
 * inadvertently expose an additional unauthenticated endpoint.
 */

import { WebSocket, WebSocketServer } from "ws";

import { type AgentScriptSpec, validateAgentScriptSpec } from "../../agent";
import type { ControlPlaneClient } from "../../controlplane/ControlPlaneClient";
import type { PlayerState } from "../../game/player";
import type { GameEventBus } from "../../game/events/GameEventBus";
import type { PlayerManager } from "../../game/player";
import type { PersistenceProvider } from "../../game/state/PersistenceProvider";
import { nowMicros } from "../../game/state/SpacetimeStateIds";
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
} from "./BotSdkCodec";
import { BotSdkEventBridge } from "./BotSdkEventBridge";
import {
    BotSdkProposalRegistry,
    type BotSdkScriptProposalRecord,
} from "./BotSdkProposalRegistry";
import { BotSdkScriptController } from "./BotSdkScriptController";
import type { BotSdkTrajectoryRecorder } from "./BotSdkTrajectoryRecorder";
import type {
    AnyActionFrame,
    ClientFrame,
    ProposalDecisionFrame,
    RuntimeEventFrame,
    ServerFrame,
    ScriptFrame,
    ScriptProposalFrame,
    SpawnFrame,
} from "./BotSdkProtocol";
import { BotSdkPerceptionEmitter } from "./BotSdkPerceptionEmitter";

export interface BotSdkServerOptions {
    host: string;
    port: number;
    /** Shared secret. If empty/undefined the server refuses to start. */
    token: string;
    /** Display name shown in the `authOk` frame. Defaults to "xrsps". */
    serverName?: string;
    /** Perception emission cadence; default 3 game ticks. */
    perceptionEveryNTicks?: number;
}

export interface BotSdkServerDeps {
    factory: AgentPlayerFactory;
    router: BotSdkActionRouter;
    recorder?: BotSdkTrajectoryRecorder;
    controlPlane?: ControlPlaneClient;
    worldId?: string;
    eventBus?: GameEventBus;
    players?: () => PlayerManager | undefined;
    /** Called on every game tick so the emitter can run. */
    hookTicker: (cb: (tick: number) => void) => void;
    /**
     * Same persistence layer humans use. The server calls `saveSnapshot`
     * on disconnect so agents retain their game state across sessions.
     */
    playerPersistence: PersistenceProvider;
}

interface AgentSession {
    ws: WebSocket;
    player: PlayerState;
    authedAt: number;
    saveKey: string;
}

const PROTOCOL_VERSION = 1;

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
    private emitter: BotSdkPerceptionEmitter | null = null;
    private eventBridge: BotSdkEventBridge | null = null;
    private readonly scriptController: BotSdkScriptController;
    private journalWriteChain: Promise<void> = Promise.resolve();
    private nextJournalSerial = 0;

    constructor(
        private readonly options: BotSdkServerOptions,
        private readonly deps: BotSdkServerDeps,
    ) {
        this.scriptController = new BotSdkScriptController({
            router: deps.router,
            recorder: deps.recorder,
            emitEvent: (player, frame) => this.emitRuntimeEvent(player, frame),
        });
    }

    /**
     * Bring the endpoint up. Must be called after the rest of the server
     * is wired, because the action router needs a live `PlayerManager`.
     * No-op (with a warning) if `BOT_SDK_TOKEN` is empty.
     */
    start(): void {
        if (!this.options.token || this.options.token.length === 0) {
            logger.info(
                "[botsdk] disabled — BOT_SDK_TOKEN not set. Agents cannot connect.",
            );
            return;
        }

        this.wss = new WebSocketServer({
            host: this.options.host,
            port: this.options.port,
        });
        this.wss.on("listening", () => {
            logger.info(
                `[botsdk] listening on ws://${this.options.host}:${this.options.port} (token=set)`,
            );
        });
        this.wss.on("error", (err) => {
            logger.error("[botsdk] server error:", err);
        });
        this.wss.on("connection", (ws) => this.handleConnection(ws));

        this.emitter = new BotSdkPerceptionEmitter(
            () => this.iterAgentPlayers(),
            (player, snapshot) => {
                const session = this.findSessionByPlayer(player);
                if (!session) return;
                this.sendFrame(session.ws, {
                    kind: "perception",
                    snapshot,
                });
                this.deps.recorder?.recordPerception(player, snapshot);
            },
            { everyNTicks: this.options.perceptionEveryNTicks },
        );
        this.deps.hookTicker((tick) => this.handleTick(tick));
        if (this.deps.eventBus && this.deps.players) {
            this.eventBridge = new BotSdkEventBridge({
                eventBus: this.deps.eventBus,
                resolvePlayerById: (playerId) => this.deps.players?.()?.getPlayerById(playerId),
                sink: (player, frame) => this.handleRuntimeEvent(player, frame),
            });
        }
    }

    stop(): void {
        for (const session of this.sessions.values()) {
            try {
                session.ws.close(1001, "server_shutdown");
            } catch {
                // swallow — the socket may already be dead
            }
        }
        this.sessions.clear();
        this.eventBridge?.dispose();
        this.eventBridge = null;
        this.wss?.close();
        this.wss = null;
        void this.deps.recorder?.dispose();
    }

    /**
     * Fan out an operator-steering command to every connected agent.
     *
     * Called from the chat handler when a human player sends
     * `::steer <text>`. The command becomes a server → client
     * `operatorCommand` frame that the plugin's BotSdk handles by
     * injecting the text into the next LLM prompt as the agent's
     * highest-priority directive.
     *
     * No-op if no agents are connected or if the endpoint is disabled.
     */
    broadcastOperatorCommand(
        source: "chat" | "admin",
        text: string,
        fromPlayerId?: number,
        fromPlayerName?: string,
    ): number {
        if (!this.wss) return 0;
        const trimmed = text.trim();
        const frame = {
            kind: "operatorCommand" as const,
            source,
            text: trimmed,
            timestamp: Date.now(),
            fromPlayerId,
            fromPlayerName,
        };
        let count = 0;
        for (const session of this.sessions.values()) {
            this.sendFrame(session.ws, frame);
            this.deps.recorder?.recordOperatorCommand(session.player, frame);
            this.scriptController.onOperatorCommand(session.player, frame);
            count += 1;
        }
        if (count > 0) {
            logger.info(
                `[botsdk] broadcast operator command → ${count} agent(s) source=${source} text="${trimmed.slice(0, 60)}"`,
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

    // ──────────────────────────────────────────────────────────────────
    // Connection handling
    // ──────────────────────────────────────────────────────────────────

    private handleConnection(ws: WebSocket): void {
        const sessionState: { authed: boolean; session?: AgentSession } = {
            authed: false,
        };

        ws.on("message", (data) => {
            const text =
                typeof data === "string"
                    ? data
                    : Buffer.isBuffer(data)
                        ? data.toString("utf-8")
                        : Buffer.from(data as ArrayBuffer).toString("utf-8");
            this.handleMessage(ws, sessionState, text);
        });

        ws.on("close", (code, reasonBuffer) => {
            const existing = this.sessions.get(ws);
            if (existing) {
                const reason =
                    typeof reasonBuffer === "string"
                        ? reasonBuffer
                        : reasonBuffer.length > 0
                            ? reasonBuffer.toString("utf-8")
                            : undefined;
                // 1. Persist the agent's game state so the next spawn resumes
                //    skills, inventory, position, etc. — same save path humans
                //    use during logout.
                try {
                    this.deps.playerPersistence.saveSnapshot(
                        existing.saveKey,
                        existing.player,
                    );
                    logger.info(
                        `[botsdk] saved state for agent ${existing.player.agent?.identity.agentId} (key=${existing.saveKey})`,
                    );
                } catch (err) {
                    logger.warn(
                        `[botsdk] failed to save state for agent ${existing.player.agent?.identity.agentId}`,
                        err,
                    );
                }

                // 2. Mark the component disconnected (perception emitter
                //    stops sending to this agent immediately).
                this.deps.factory.markDisconnected(existing.player);

                // 3. Remove the PlayerState from the world entirely so the
                //    agent's display name is freed for subsequent logins.
                //    The save file is the source of truth from here on.
                try {
                    this.deps.factory.destroy(existing.player);
                } catch (err) {
                    logger.warn(
                        `[botsdk] failed to destroy agent player ${existing.player.id}`,
                        err,
                    );
                }

                this.deps.recorder?.recordDisconnect(
                    existing.player,
                    reason ?? `ws_close:${code}`,
                );
                this.proposalRegistry.removeByPlayerId(existing.player.id);
                this.sessions.delete(ws);
                logger.info(
                    `[botsdk] session closed for player ${existing.player.id} (agent=${existing.player.agent?.identity.agentId})`,
                );
            }
        });

        ws.on("error", (err) => {
            logger.warn("[botsdk] socket error:", err);
        });
    }

    private handleMessage(
        ws: WebSocket,
        state: { authed: boolean; session?: AgentSession },
        raw: string,
    ): void {
        const decoded = decodeClientFrame(raw);
        if (!decoded.ok) {
            this.sendError(ws, "bad_frame", decoded.error);
            return;
        }
        const frame: ClientFrame = decoded.value;

        // Auth must come first.
        if (!state.authed) {
            if (frame.kind !== "auth") {
                this.sendError(ws, "unauth", "first frame must be `auth`");
                ws.close(1008, "unauth");
                return;
            }
            if (frame.token !== this.options.token) {
                this.sendError(ws, "bad_token", "BOT_SDK_TOKEN mismatch");
                ws.close(1008, "bad_token");
                return;
            }
            state.authed = true;
            this.sendFrame(ws, {
                kind: "authOk",
                server: this.options.serverName ?? "xrsps",
                version: PROTOCOL_VERSION,
            });
            return;
        }

        // Post-auth flow.
        switch (frame.kind) {
            case "auth":
                // Re-auth attempt — ignore silently.
                return;
            case "spawn":
                void this.handleSpawn(ws, state, frame).catch((err) => {
                    logger.error("[botsdk] spawn failed", err);
                    this.sendError(ws, "spawn_failed", "Failed to spawn agent.");
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
                logger.info(
                    `[botsdk] client requested disconnect: ${frame.reason ?? "(no reason)"}`,
                );
                ws.close(1000, frame.reason ?? "client_disconnect");
                return;
        }
    }

    private async handleSpawn(
        ws: WebSocket,
        state: { authed: boolean; session?: AgentSession },
        frame: SpawnFrame,
    ): Promise<void> {
        if (state.session) {
            this.sendError(
                ws,
                "already_spawned",
                `agent ${state.session.player.agent?.identity.agentId} already owns this socket`,
            );
            return;
        }

        const result = await this.deps.factory.spawn({
            agentId: frame.agentId,
            displayName: frame.displayName,
            password: frame.password,
            sessionToken: frame.sessionToken,
            worldCharacterId: frame.worldCharacterId,
            controller: frame.controller ?? "hybrid",
            persona: frame.persona,
        });
        if (!result.ok) {
            this.sendError(ws, result.code, result.message);
            return;
        }

        const session: AgentSession = {
            ws,
            player: result.player,
            authedAt: Date.now(),
            saveKey: result.saveKey,
        };
        state.session = session;
        this.sessions.set(ws, session);
        this.deps.recorder?.recordSpawn(result.player, result.saveKey);

        if (result.created) {
            logger.info(
                `[botsdk] new agent account registered: ${result.player.name}`,
            );
        }

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
        state: { authed: boolean; session?: AgentSession },
        frame: AnyActionFrame,
    ): void {
        if (!state.session) {
            this.sendError(
                ws,
                "not_spawned",
                "must send `spawn` frame before `action`",
            );
            return;
        }

        this.deps.recorder?.recordActionDispatch(state.session.player, frame);
        const dispatch: ActionDispatchResult = this.deps.router.dispatch(
            state.session.player.id,
            frame,
        );
        this.deps.recorder?.recordActionResult(state.session.player, frame, dispatch);

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
        state: { authed: boolean; session?: AgentSession },
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
            this.sendError(ws, code, message);
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
        state: { authed: boolean; session?: AgentSession },
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
            this.sendError(ws, code, message);
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

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

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
        this.sendFrame(session.ws, frame);
        this.deps.recorder?.recordRuntimeEvent(player, frame);
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

    private sendFrame(ws: WebSocket, frame: ServerFrame): void {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
            ws.send(encodeServerFrame(frame));
        } catch (err) {
            logger.warn("[botsdk] failed to send frame:", err);
        }
    }

    private sendError(ws: WebSocket, code: string, message: string): void {
        this.sendFrame(ws, { kind: "error", code, message });
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
            if (session.player.id === player.id) return session;
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
        if (this.journalActivity.length > 24) {
            this.journalActivity.length = 24;
        }
    }

    private recordJournalLiveEvent(
        player: PlayerState | undefined,
        eventName: string,
        payload: Record<string, unknown>,
    ): void {
        if (!this.deps.controlPlane || !this.deps.worldId) {
            return;
        }

        const recordedAt = nowMicros();
        const serial = ++this.nextJournalSerial;
        const payloadJson = safeJsonStringify(payload);

        this.journalWriteChain = this.journalWriteChain.then(async () => {
            await this.deps.controlPlane?.putLiveEvent({
                event_id: `journal:${this.deps.worldId}:${recordedAt.toString()}:${serial}`,
                world_id: this.deps.worldId!,
                principal_id: player?.__principalId,
                world_character_id: player?.__worldCharacterId,
                player_id: player?.id,
                source: "botsdk_journal",
                event_name: eventName,
                payload_json: payloadJson,
                recorded_at: recordedAt,
            });
        }).catch((error) => {
            logger.error(`[botsdk] failed to record ${eventName}`, error);
        });
    }
}
