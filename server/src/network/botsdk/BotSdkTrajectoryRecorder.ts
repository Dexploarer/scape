import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { PlayerState } from "../../game/player";

import type { AnyActionFrame } from "./BotSdkProtocol";
import type { ActionDispatchResult } from "./BotSdkActionRouter";
import type { BotSdkLiveEvent } from "./BotSdkLiveEventRelay";

export interface BotSdkTrajectoryEntry {
    phase: "wake" | "action" | "ack";
    timestamp: number;
    worldId: string;
    playerId: number;
    playerName?: string;
    agentId?: string;
    event?: string;
    action?: string;
    correlationId?: string;
    success?: boolean;
    payload?: Record<string, unknown>;
}

export interface BotSdkTrajectorySink {
    write(entry: BotSdkTrajectoryEntry): void;
    dispose?(): void;
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

export interface BotSdkTrajectoryRecorderOptions {
    worldId: string;
    sink: BotSdkTrajectorySink;
    now?: () => number;
}

export class BotSdkTrajectoryRecorder {
    private readonly now: () => number;

    constructor(private readonly options: BotSdkTrajectoryRecorderOptions) {
        this.now = options.now ?? (() => Date.now());
    }

    dispose(): void {
        this.options.sink.dispose?.();
    }

    recordWakeEvent(player: PlayerState, event: BotSdkLiveEvent): void {
        this.options.sink.write({
            phase: "wake",
            timestamp: event.timestamp,
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            agentId: player.agent?.identity.agentId,
            event: event.event,
            payload: event.payload,
        });
    }

    recordActionDispatch(player: PlayerState, frame: AnyActionFrame): void {
        this.options.sink.write({
            phase: "action",
            timestamp: this.now(),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            agentId: player.agent?.identity.agentId,
            action: frame.action,
            correlationId: frame.correlationId,
            payload: this.extractActionPayload(frame),
        });
    }

    recordActionAck(
        player: PlayerState,
        frame: AnyActionFrame,
        result: ActionDispatchResult,
    ): void {
        this.options.sink.write({
            phase: "ack",
            timestamp: this.now(),
            worldId: this.options.worldId,
            playerId: player.id,
            playerName: player.name ?? undefined,
            agentId: player.agent?.identity.agentId,
            action: frame.action,
            correlationId: frame.correlationId,
            success: result.success,
            payload: {
                message: result.message,
            },
        });
    }

    private extractActionPayload(frame: AnyActionFrame): Record<string, unknown> {
        switch (frame.action) {
            case "walkTo":
                return { x: frame.x, z: frame.z, run: !!frame.run };
            case "chatPublic":
                return { text: frame.text };
            case "attackNpc":
                return { npcId: frame.npcId };
            case "dropItem":
                return { slot: frame.slot };
            case "eatFood":
                return { slot: frame.slot };
        }
    }
}
