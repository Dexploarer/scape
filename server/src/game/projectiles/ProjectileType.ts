export type ProjectileArchetypeName =
    | "BOLT"
    | "ARROW"
    | "JAVELIN"
    | "THROWN"
    | "CHINCHOMPA"
    | "MAGIC";

export type ProjectileLifeModel = "linear5" | "linear5-clamped10" | "javelin" | "magic";

export interface ProjectileArchetype {
    name: ProjectileArchetypeName;
    startHeight: number;
    endHeight: number;
    delayFrames: number;
    angle: number;
    steepness: number;
    lifeModel: ProjectileLifeModel;
}

const base = (
    name: ProjectileArchetypeName,
    props: Omit<ProjectileArchetype, "name">,
): ProjectileArchetype => ({
    name,
    startHeight: props.startHeight,
    endHeight: props.endHeight,
    delayFrames: props.delayFrames,
    angle: props.angle,
    steepness: props.steepness,
    lifeModel: props.lifeModel,
});

export const PROJECTILE_ARCHETYPES: Record<ProjectileArchetypeName, ProjectileArchetype> = {
    BOLT: base("BOLT", {
        startHeight: 38,
        endHeight: 36,
        delayFrames: 41,
        angle: 5,
        steepness: 11,
        lifeModel: "linear5-clamped10",
    }),
    ARROW: base("ARROW", {
        startHeight: 40,
        endHeight: 36,
        delayFrames: 41,
        angle: 15,
        steepness: 11,
        lifeModel: "linear5-clamped10",
    }),
    JAVELIN: base("JAVELIN", {
        startHeight: 38,
        endHeight: 36,
        delayFrames: 42,
        angle: 1,
        steepness: 120,
        lifeModel: "javelin",
    }),
    THROWN: base("THROWN", {
        startHeight: 40,
        endHeight: 36,
        delayFrames: 32,
        angle: 15,
        steepness: 11,
        lifeModel: "linear5",
    }),
    CHINCHOMPA: base("CHINCHOMPA", {
        startHeight: 40,
        endHeight: 36,
        delayFrames: 21,
        angle: 15,
        steepness: 11,
        lifeModel: "linear5",
    }),
    MAGIC: base("MAGIC", {
        startHeight: 86, // Doubled from 43 (86 * 4 = 344 game units, staff tip height)
        endHeight: 31,
        delayFrames: 51, // ~1.7 ticks = 1020ms windup before projectile spawns
        angle: 16,
        steepness: 64,
        lifeModel: "magic",
    }),
};

/**
 * Convert RSMod projectile lifespan heuristics into client-frame units (20ms steps).
 * @returns number of client frames the projectile should persist, or -1 to signal caller-provided logic.
 */
export function calculateProjectileLifeFrames(
    archetype: ProjectileArchetypeName,
    distanceTiles: number,
): number {
    const dist = Math.max(0, distanceTiles);
    const model = PROJECTILE_ARCHETYPES[archetype].lifeModel;
    switch (model) {
        case "linear5":
            return dist * 5;
        case "linear5-clamped10":
            return Math.max(10, dist * 5);
        case "javelin":
            return dist * 3 + 2;
        case "magic":
        default:
            return -1;
    }
}
