import type { SoundBroadcastRequest as NetworkSoundBroadcastRequest } from "../../../network/managers/SoundManager";
import type { ActionKind, ActionRequest } from "../types";

export interface ProjectileTiming {
    startDelay: number;
    travelTime: number;
    hitDelay: number;
    lineOfSight?: boolean;
}

export interface SpotAnimRequest {
    tick: number;
    playerId?: number;
    npcId?: number;
    slot?: number;
    spotId: number;
    delay?: number;
    height?: number;
    tile?: { x: number; y: number; level?: number };
}

export type SoundBroadcastRequest = NetworkSoundBroadcastRequest;
export type SoundRequest = SoundBroadcastRequest;

export type ActionScheduleRequest<K extends ActionKind = ActionKind> = ActionRequest<K>;

export interface ActionScheduleResult {
    ok: boolean;
    reason?: string;
}
