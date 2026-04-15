import type { AgentPerceptionSnapshot } from "../../agent";
import type {
    ControlPlaneClient,
    PutTrajectoryStepPayload,
    UpsertTrajectoryEpisodePayload,
} from "../../controlplane/ControlPlaneClient";
import { nowMicros } from "../../game/state/SpacetimeStateIds";
import type { PlayerState } from "../../game/player";
import { logger } from "../../utils/logger";
import {
    safeJsonStringifyOptional,
} from "../../utils/safeJsonStringify";

import type { ActionDispatchResult } from "./BotSdkActionRouter";
import type {
    AnyActionFrame,
    OperatorCommandFrame,
    RuntimeEventFrame,
} from "./BotSdkProtocol";

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

export interface BotSdkTrajectoryRecorderOptions {
    controlPlane: ControlPlaneClient;
    worldId: string;
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
            await this.options.controlPlane.upsertTrajectoryEpisode(episodePayload);
            await this.options.controlPlane.putTrajectoryStep(step);
        });
    }

    recordPerception(player: PlayerState, snapshot: AgentPerceptionSnapshot): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode) return;
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
            await this.options.controlPlane.putTrajectoryStep(step);
        });
    }

    recordActionDispatch(player: PlayerState, frame: AnyActionFrame): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode) return;
        const step = this.createStep(episode, {
            event_kind: "action_dispatch",
            action_name: frame.action,
            correlation_id: frame.correlationId,
            payload_json: safeJsonStringifyOptional(frame),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane.putTrajectoryStep(step);
        });
    }

    recordActionResult(
        player: PlayerState,
        frame: AnyActionFrame,
        dispatch: ActionDispatchResult,
    ): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode) return;
        const step = this.createStep(episode, {
            event_kind: "action_result",
            action_name: frame.action,
            correlation_id: frame.correlationId,
            payload_json: safeJsonStringifyOptional(frame),
            outcome_json: safeJsonStringifyOptional(dispatch),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane.putTrajectoryStep(step);
        });
    }

    recordOperatorCommand(
        player: PlayerState,
        frame: Pick<
            OperatorCommandFrame,
            "source" | "text" | "timestamp" | "fromPlayerId" | "fromPlayerName"
        >,
    ): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode) return;
        const step = this.createStep(episode, {
            event_kind: "operator_command",
            payload_json: safeJsonStringifyOptional(frame),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane.putTrajectoryStep(step);
        });
    }

    recordRuntimeEvent(player: PlayerState, frame: RuntimeEventFrame): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode) return;
        const step = this.createStep(episode, {
            event_kind: "runtime_event",
            payload_json: safeJsonStringifyOptional(frame),
            recorded_at: nowMicros(),
        });
        this.enqueue(async () => {
            await this.options.controlPlane.putTrajectoryStep(step);
        });
    }

    recordDisconnect(player: PlayerState, reason?: string): void {
        const episode = this.episodesByPlayerId.get(player.id);
        if (!episode) return;
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
            await this.options.controlPlane.putTrajectoryStep(step);
            await this.options.controlPlane.upsertTrajectoryEpisode(episodePayload);
        });
    }

    async dispose(): Promise<void> {
        await this.writeChain;
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

    private enqueue(task: () => Promise<void>): void {
        this.writeChain = this.writeChain.then(task).catch((error) => {
            logger.error("[spacetime] bot trajectory write failed", error);
        });
    }
}
