import type { BasType } from "../../../../src/rs/config/bastype/BasType";

export type PlayerAnimSet = {
    idle?: number;
    walk?: number;
    walkBack?: number;
    walkLeft?: number;
    walkRight?: number;
    run?: number;
    runBack?: number;
    runLeft?: number;
    runRight?: number;
    turnLeft?: number;
    turnRight?: number;
};

const HARD_CODED_CORE_DEFAULTS = {
    idle: 808,
    walk: 819,
    run: 824,
    turnLeft: 823,
    turnRight: 823,
} as const;

type CoreAnimKey = "idle" | "walk" | "run" | "turnLeft" | "turnRight";

export function pickAnimId(value: unknown): number | undefined {
    if (!Number.isFinite(value as number)) return undefined;
    const animId = value as number;
    return animId >= 0 ? animId : undefined;
}

/**
 * Extract player movement/idle sequence ids from a BAS type object.
 * Returns a sparse set: missing/65535 values become `undefined`.
 */
export function buildAnimSetFromBas(bas: BasType | undefined): PlayerAnimSet | undefined {
    if (!bas) return undefined;
    return {
        idle: pickAnimId(bas.idleSeqId),
        walk: pickAnimId(bas.walkSeqId),
        walkBack: pickAnimId(bas.walkBackSeqId),
        walkLeft: pickAnimId(bas.walkLeftSeqId),
        walkRight: pickAnimId(bas.walkRightSeqId),
        run: pickAnimId(bas.runSeqId),
        runBack: pickAnimId(bas.runBackSeqId),
        runLeft: pickAnimId(bas.runLeftSeqId),
        runRight: pickAnimId(bas.runRightSeqId),
        turnLeft: pickAnimId(bas.idleLeftSeqId),
        turnRight: pickAnimId(bas.idleRightSeqId) ?? pickAnimId(bas.idleLeftSeqId),
    };
}

/**
 * Ensure the core movement sequences exist on the returned set so the client
 * never keeps stale values after equipment changes.
 *
 * Core keys: idle, walk, run, turnLeft, turnRight.
 */
export function ensureCorePlayerAnimSet(
    raw: PlayerAnimSet | undefined,
    ...fallbacks: Array<PlayerAnimSet | undefined>
): PlayerAnimSet {
    const out: PlayerAnimSet = { ...(raw ?? {}) };

    const fallbackValue = (key: CoreAnimKey): number | undefined => {
        for (const fb of fallbacks) {
            const v = pickAnimId(fb?.[key]);
            if (v !== undefined) return v;
        }
        return HARD_CODED_CORE_DEFAULTS[key];
    };

    out.idle = pickAnimId(out.idle) ?? fallbackValue("idle");
    out.walk = pickAnimId(out.walk) ?? fallbackValue("walk");
    out.run = pickAnimId(out.run) ?? fallbackValue("run");
    out.turnLeft = pickAnimId(out.turnLeft) ?? fallbackValue("turnLeft");
    out.turnRight = pickAnimId(out.turnRight) ?? fallbackValue("turnRight") ?? out.turnLeft;

    return out;
}
