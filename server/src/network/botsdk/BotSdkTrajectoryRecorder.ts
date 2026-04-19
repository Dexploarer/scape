import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { AgentPerceptionSnapshot } from "../../agent";
import type {
    ControlPlaneClient,
    PutTrajectoryStepPayload,
    UpsertTrajectoryEpisodePayload,
} from "../../controlplane/ControlPlaneClient";
import { nowMicros } from "../../game/state/SpacetimeStateIds";
import type { PlayerState } from "../../game/player";
import { logger } from "../../utils/logger";
import { safeJsonStringifyOptional } from "../../utils/safeJsonStringify";

import type { ActionDispatchResult } from "./BotSdkActionRouter";
import type { BotSdkLiveEvent } from "./BotSdkLiveEventRelay";
import type {
    AnyActionFrame,
    OperatorCommandFrame,
    RuntimeEventFrame,
} from "./BotSdkProtocol";

export interface BotSdkTrajectoryEntry {
    phase: "spawn" | "wake" | "perception" | "action" | "ack" | "operator" | "disconnect";
    timestamp: number;
    worldId: string;
    playerId: number;
    playerName?: string;
    principalId?: string;
    worldCharacterId?: string;
    agentId?: string;
    event?: string;
    action?: string;
    correlationId?: string;
    success?: boolean;
    payload?: Record<string, unknown>;
}

export interface BotSdkTrajectorySink {
    write(entry: BotSdkTrajectoryEntry): void;
    dispose?(): void | Promise<void>;
}

export class JsonlBotSdkTrajectorySink implements BotSdkTrajectorySink {
    constructor(private readonly filePath: string) {}

    write(entry: BotSdkTrajectoryEntry): void {
        mkdirSync(dirname(this.filePath), { recursive: true });
        appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, "utf-8");
    }
}

export class MemoryBotSdkTrajectorySink implements BotSdkTrajectorySink {
    readonly entries: BotSdkTrajectoryEntry[] = [];

    write(entry: BotSdkTrajectoryEntry): void {
        this.entries.push(entry);
    }
}

interface EpisodeState {
    episodeId: string;
    worldId: string;
    principalId: string;
    worldCharacterId: string;
    agentId: string;
    playerId: number;
    sessionSource: string;
    metadataJson: string | undefined;
    startedAt: bigint;
    nextSequence: number;
}

interface TrajectoryStepInput {
    event_kind: string;
    action_name?: string;
    correlation_id?: string;
    observation_json?: string;
    payload_json?: string;
    outcome_json?: string;
    recorded_at: bigint;
}

export interface BotSdkTrajectoryRecorderOptions {
    worldId: string;
    controlPlane?: ControlPlaneClient;
    sink?: BotSdkTrajectorySink;
}

function describePlayer(player: PlayerState) {
    return {
        playerId: player.id,
        displayName: player.name ?? "",
        principalId: player.__principalId,
        worldCharacterId: player.__worldCharacterId,
        agentId: player.agent?.identity.agentId,
    };
}

export class BotSdkTrajectoryRecorder {
    private readonly episodesByPlayerId = new Map<number, EpisodeState>();
    private writeChain: Promise<void> = Promise.resolve();

    constructor(private readonly options: BotSdkTrajectoryRecorderOptions) {}

    recordSpawn(player: PlayerState, saveKey: string): void {
        const recordedAt = nowMicros();
        const principalId =
            player.__principalId ?? `principal:${this.options.worldId}:player:${player.id}`;
        const worldCharacterId =
            player.__worldCharacterId ??
            `world-character:${this.options.worldId}:id:${player.id}`;
        const agentId = player.agent?.identity.agentId ?? `agent:${player.id}`;
        const metadataJson = safeJsonStringifyOptional({
            saveKey,
            controller: player.agent?.identity.controller,
            persona: player.agent?.identity.persona,
            displayName: player.name ?? "",
        });
        const episode: EpisodeState = {
            episodeId: `trajectory-episode:${this.options.worldId}:${worldCharacterId}:${recordedAt.toString()}`,
            worldId: this.options.worldId,
            principalId,
            worldCharacterId,
            agentId,
            playerId: player.id,
            sessionSource: "botsdk",
            metadataJson,
            startedAt: recordedAt,
            nextSequence: 0,
        };
        this.episodesByPlayerId.set(player.id, episode);

        this.writeLegacyEntry(player, {
            phase: "spawn",
            timestamp: Number(recordedAt / 1000n),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId,
            worldCharacterId,
            agentId,
            payload: {
                saveKey,
                x: player.tileX,
                z: player.tileY,
                level: player.level,
            },
        });

        if (!this.options.controlPlane) return;
        const episodePayload: UpsertTrajectoryEpisodePayload = {
            episode_id: episode.episodeId,
            world_id: episode.worldId,
            principal_id: episode.principalId,
            world_character_id: episode.worldCharacterId,
            agent_id: episode.agentId,
            player_id: episode.playerId,
            session_source: episode.sessionSource,
            metadata_json: episode.metadataJson,
            started_at: episode.startedAt,
            ended_at: undefined,
        };
        const step = this.createStep(episode, {
            event_kind: "spawn",
            payload_json: safeJsonStringifyOptional({
                ...describePlayer(player),
                saveKey,
                x: player.tileX,
                z: player.tileY,
                level: player.level,
            }),
            recorded_at: recordedAt,
        });
        this.enqueue(async () => {
            await this.options.controlPlane?.upsertTrajectoryEpisode?.(episodePayload);
            await this.options.controlPlane?.putTrajectoryStep?.(step);
        });
    }

    recordWakeEvent(player: PlayerState, event: BotSdkLiveEvent): void {
        this.writeLegacyEntry(player, {
            phase: "wake",
            timestamp: event.timestamp,
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
            agentId: player.agent?.identity.agentId,
            event: event.event,
            payload: event.payload,
        });
        this.recordRuntimeEvent(player, {
            kind: "event",
            name: event.event,
            event: event.event,
            timestamp: event.timestamp,
            payload: event.payload,
        });
    }

    recordPerception(player: PlayerState, snapshot: AgentPerceptionSnapshot): void {
        this.writeLegacyEntry(player, {
            phase: "perception",
            timestamp: Date.now(),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
            agentId: player.agent?.identity.agentId,
            payload: { tick: snapshot.tick },
        });

        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode || !this.options.controlPlane) return;
        const recordedAt = nowMicros();
        const step = this.createStep(episode, {
            event_kind: "perception",
            observation_json: safeJsonStringifyOptional(snapshot),
            payload_json: safeJsonStringifyOptional({
                ...describePlayer(player),
                tick: snapshot.tick,
            }),
            recorded_at: recordedAt,
        });
        this.enqueue(async () => {
            await this.options.controlPlane?.putTrajectoryStep?.(step);
        });
    }

    recordActionDispatch(player: PlayerState, frame: AnyActionFrame): void {
        this.writeLegacyEntry(player, {
            phase: "action",
            timestamp: Date.now(),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
            agentId: player.agent?.identity.agentId,
            action: frame.action,
            correlationId: frame.correlationId,
            payload: frame as unknown as Record<string, unknown>,
        });

        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode || !this.options.controlPlane) return;
        const step = this.createStep(episode, {
            event_kind: "action_dispatch",
            action_name: frame.action,
            correlation_id: frame.correlationId,
            payload_json: safeJsonStringifyOptional(frame),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane?.putTrajectoryStep?.(step);
        });
    }

    recordActionAck(
        player: PlayerState,
        frame: AnyActionFrame,
        dispatch: ActionDispatchResult,
    ): void {
        this.recordActionResult(player, frame, dispatch);
    }

    recordActionResult(
        player: PlayerState,
        frame: AnyActionFrame,
        dispatch: ActionDispatchResult,
    ): void {
        this.writeLegacyEntry(player, {
            phase: "ack",
            timestamp: Date.now(),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
            agentId: player.agent?.identity.agentId,
            action: frame.action,
            correlationId: frame.correlationId,
            success: dispatch.success,
            payload: { message: dispatch.message },
        });

        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode || !this.options.controlPlane) return;
        const step = this.createStep(episode, {
            event_kind: "action_result",
            action_name: frame.action,
            correlation_id: frame.correlationId,
            payload_json: safeJsonStringifyOptional(frame),
            outcome_json: safeJsonStringifyOptional(dispatch),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane?.putTrajectoryStep?.(step);
        });
    }

    recordOperatorCommand(
        player: PlayerState,
        frame: Pick<
            OperatorCommandFrame,
            "source" | "text" | "timestamp" | "fromPlayerId" | "fromPlayerName"
        >,
    ): void {
        this.writeLegacyEntry(player, {
            phase: "operator",
            timestamp: frame.timestamp,
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
            agentId: player.agent?.identity.agentId,
            payload: frame as unknown as Record<string, unknown>,
        });

        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode || !this.options.controlPlane) return;
        const step = this.createStep(episode, {
            event_kind: "operator_command",
            payload_json: safeJsonStringifyOptional(frame),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane?.putTrajectoryStep?.(step);
        });
    }

    recordRuntimeEvent(player: PlayerState, frame: RuntimeEventFrame): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode || !this.options.controlPlane) return;
        const step = this.createStep(episode, {
            event_kind: "runtime_event",
            payload_json: safeJsonStringifyOptional(frame),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane?.putTrajectoryStep?.(step);
        });
    }

    recordDisconnect(player: PlayerState, reason?: string): void {
        this.writeLegacyEntry(player, {
            phase: "disconnect",
            timestamp: Date.now(),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
            agentId: player.agent?.identity.agentId,
            payload: { reason },
        });

        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode || !this.options.controlPlane) {
            this.episodesByPlayerId.delete(player.id);
            return;
        }
        this.episodesByPlayerId.delete(player.id);

        const endedAt = nowMicros();
        const step = this.createStep(episode, {
            event_kind: "disconnect",
            payload_json: safeJsonStringifyOptional({
                ...describePlayer(player),
                reason,
            }),
            recorded_at: endedAt,
        });
        const episodePayload: UpsertTrajectoryEpisodePayload = {
            episode_id: episode.episodeId,
            world_id: episode.worldId,
            principal_id: episode.principalId,
            world_character_id: episode.worldCharacterId,
            agent_id: episode.agentId,
            player_id: episode.playerId,
            session_source: episode.sessionSource,
            metadata_json: episode.metadataJson,
            started_at: episode.startedAt,
            ended_at: endedAt,
        };
        this.enqueue(async () => {
            await this.options.controlPlane?.putTrajectoryStep?.(step);
            await this.options.controlPlane?.upsertTrajectoryEpisode?.(episodePayload);
        });
    }

    async dispose(): Promise<void> {
        await this.writeChain;
        await this.options.sink?.dispose?.();
    }

    private createStep(
        episode: EpisodeState,
        step: TrajectoryStepInput,
    ): PutTrajectoryStepPayload {
        episode.nextSequence += 1;
        return {
            step_id: `${episode.episodeId}:step:${episode.nextSequence}`,
            episode_id: episode.episodeId,
            world_id: episode.worldId,
            principal_id: episode.principalId,
            world_character_id: episode.worldCharacterId,
            player_id: episode.playerId,
            sequence: episode.nextSequence,
            event_kind: step.event_kind,
            action_name: step.action_name,
            correlation_id: step.correlation_id,
            observation_json: step.observation_json,
            payload_json: step.payload_json,
            outcome_json: step.outcome_json,
            recorded_at: step.recorded_at,
        };
    }

    private writeLegacyEntry(player: PlayerState, entry: BotSdkTrajectoryEntry): void {
        this.options.sink?.write({
            ...entry,
            playerName: entry.playerName ?? player.name ?? undefined,
            principalId: entry.principalId ?? player.__principalId,
            worldCharacterId: entry.worldCharacterId ?? player.__worldCharacterId,
            agentId: entry.agentId ?? player.agent?.identity.agentId,
        });
    }

    private enqueue(task: () => Promise<void>): void {
        this.writeChain = this.writeChain.then(task).catch((error) => {
            logger.error("[spacetime] bot trajectory write failed", error);
        });
    }
}
