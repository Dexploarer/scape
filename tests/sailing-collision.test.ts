/**
 * Sailing deck collision test.
 * Verifies the CollisionOverlayStore correctly blocks non-deck tiles at dock coords.
 *
 * Run with:  npx tsx tests/sailing-collision.test.ts
 */

import { CollisionOverlayStore } from "../server/src/world/CollisionOverlayStore";

// Dock offset: player is at Port Sarim overworld, NOT the source instance region
const DOCK_OFFSET_X = 3050;
const DOCK_OFFSET_Y = 3189;
const FULL_BLOCK = 0xffffff;

const DECK_TILES: Array<[number, number]> = [
    [3, 2], [4, 2],
    [3, 3], [4, 3],
    [3, 4], [4, 4],
    [3, 5], [4, 5],
];

function applyDeckCollision(overlay: CollisionOverlayStore): void {
    const bx = DOCK_OFFSET_X;
    const by = DOCK_OFFSET_Y;
    const deckSet = new Set(DECK_TILES.map(([dx, dy]) => `${bx + dx},${by + dy}`));
    for (let plane = 0; plane < 4; plane++) {
        for (let dx = 0; dx < 8; dx++) {
            for (let dy = 0; dy < 8; dy++) {
                const wx = bx + dx;
                const wy = by + dy;
                if (!deckSet.has(`${wx},${wy}`)) {
                    overlay.addFlags(wx, wy, plane, FULL_BLOCK);
                }
            }
        }
    }
}

let pass = 0;
let fail = 0;

function assert(condition: boolean, msg: string): void {
    if (condition) {
        pass++;
    } else {
        fail++;
        console.log(`FAIL: ${msg}`);
    }
}

const overlay = new CollisionOverlayStore();
applyDeckCollision(overlay);

// Test 1: Deck tiles walkable
for (const [dx, dy] of DECK_TILES) {
    const wx = DOCK_OFFSET_X + dx;
    const wy = DOCK_OFFSET_Y + dy;
    const flags = overlay.applyOverlay(wx, wy, 0, 0);
    assert(flags === 0, `Deck tile (${dx},${dy}) = world (${wx},${wy}) should be 0, got 0x${flags.toString(16)}`);
}

// Test 2: Non-deck tiles blocked
const nonDeck: Array<[number, number]> = [
    [0, 0], [1, 1], [2, 2], [5, 3], [6, 4], [7, 7],
    [3, 0], [4, 1], [3, 6], [4, 7], [2, 4], [5, 4],
];
for (const [dx, dy] of nonDeck) {
    const wx = DOCK_OFFSET_X + dx;
    const wy = DOCK_OFFSET_Y + dy;
    const flags = overlay.applyOverlay(wx, wy, 0, 0);
    assert(flags === FULL_BLOCK, `Non-deck (${dx},${dy}) = (${wx},${wy}) should be blocked, got 0x${flags.toString(16)}`);
}

// Test 3: Player spawn at dock (3054, 3193) = (bx+4, by+4) walkable
const spawnFlags = overlay.applyOverlay(3054, 3193, 0, 0);
assert(spawnFlags === 0, `Spawn (3054,3193) should be walkable, got 0x${spawnFlags.toString(16)}`);

// Test 4: Just outside deck blocked
assert(overlay.applyOverlay(3055, 3193, 0, 0) === FULL_BLOCK, `(3055,3193) should be blocked`);
assert(overlay.applyOverlay(3052, 3193, 0, 0) === FULL_BLOCK, `(3052,3193) should be blocked`);

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
