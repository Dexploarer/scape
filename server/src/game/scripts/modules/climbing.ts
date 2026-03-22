import { type LocInteractionEvent, type ScriptModule } from "../types";

// ---------------------------------------------------------------------------
// OSRS Loc Traversal System
//
// Handles all generic loc-based player movement: stairs, ladders, dungeon
// entrances, trapdoors, etc.
//
// Three resolution layers (checked in order by ScriptRegistry.findLocInteraction):
//   1. Per-loc overrides   – registerLocInteraction(locId, handler)
//      Use for quest-gated, skill-gated, or otherwise special-case locs.
//   2. Destination table    – LOC_DESTINATIONS below
//      Use when a loc goes to a specific coord that differs from plane +/- 1.
//   3. Generic defaults     – registerLocAction("climb-up" | "climb-down" | ...)
//      Handles the vast majority of stairs/ladders: same tile, plane +/- 1.
// ---------------------------------------------------------------------------

// -- Animations (from animation_names.txt) -----------------------------------
const LADDER_CLIMB_ANIM = 828; // human_reachforladder

// -- Sounds (from osrs-synths.json) ------------------------------------------
const STAIR_SOUND = 2420; // up_and_down_stairs

// -- Destination overrides ---------------------------------------------------
// Only locs that do NOT follow the default plane +/- 1 rule need entries here.
// Key: locId, Value: absolute destination { x, y, level }.
//
// Add entries as content is implemented. The generic handlers cover everything
// else automatically via the loc's cache action text (e.g. "Climb-up").
interface TraversalDestination {
    x: number;
    y: number;
    level: number;
}

const LOC_DESTINATIONS = new Map<number, TraversalDestination>([
    // -- Add entries as content requires --
    // [16154, { x: 3097, y: 9868, level: 0 }],  // Edgeville dungeon entrance
    // [14880, { x: 3209, y: 9616, level: 0 }],   // Lumbridge cellar trapdoor
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDestination(
    event: LocInteractionEvent,
    defaultLevelOffset: number,
): TraversalDestination | null {
    const override = LOC_DESTINATIONS.get(event.locId);
    if (override) return override;

    const targetLevel = event.level + defaultLevelOffset;
    if (targetLevel < 0 || targetLevel > 3) return null;

    return { x: event.player.tileX, y: event.player.tileY, level: targetLevel };
}

function executeTraversal(
    event: LocInteractionEvent,
    dest: TraversalDestination,
): void {
    const { player, tile, level, services } = event;

    services.playPlayerSeq?.(player, LADDER_CLIMB_ANIM);
    services.playAreaSound?.({
        soundId: STAIR_SOUND,
        tile,
        level,
        radius: 1,
    });
    services.teleportPlayer?.(player, dest.x, dest.y, dest.level);
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const climbingModule: ScriptModule = {
    id: "content.climbing",
    register(registry, _services) {
        // ---- climb-up: default plane + 1 ----
        registry.registerLocAction("climb-up", (event) => {
            const dest = resolveDestination(event, +1);
            if (!dest) return;
            executeTraversal(event, dest);
        });

        // ---- climb-down / descend: default plane - 1 ----
        for (const action of ["climb-down", "descend"]) {
            registry.registerLocAction(action, (event) => {
                const dest = resolveDestination(event, -1);
                if (!dest) return;
                executeTraversal(event, dest);
            });
        }

        // ---- enter: dungeon entrances, cave entries, etc. ----
        // No sane default (could be any plane/coord), so requires a mapped destination.
        registry.registerLocAction("enter", (event) => {
            const dest = LOC_DESTINATIONS.get(event.locId);
            if (!dest) {
                event.services.sendGameMessage(event.player, "Nothing interesting happens.");
                return;
            }
            executeTraversal(event, dest);
        });

        // ---- climb (ambiguous): show dialogue asking up or down ----
        registry.registerLocAction("climb", (event) => {
            const { player, level, services } = event;

            // Plane bounds are the only guard needed — if the loc has "Climb" as
            // its action in the cache, the destination is valid by definition.
            const canGoUp = level < 3;
            const canGoDown = level > 0;

            // Check destination overrides first
            const upDest = canGoUp ? resolveDestination(event, +1) : null;
            const downDest = canGoDown ? resolveDestination(event, -1) : null;

            if (upDest && downDest) {
                services.openDialogOptions?.(player, {
                    id: "climb-direction",
                    title: "Climb up or down?",
                    options: ["Climb-up.", "Climb-down."],
                    onSelect: (choiceIndex: number) => {
                        const dest = choiceIndex === 0 ? upDest : downDest;
                        if (dest) executeTraversal(event, dest);
                    },
                });
            } else if (upDest) {
                executeTraversal(event, upDest);
            } else if (downDest) {
                executeTraversal(event, downDest);
            }
        });
    },
};
