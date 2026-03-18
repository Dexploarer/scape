/**
 * Combat Pathfinding Bug Investigation Tests
 *
 * Tests to identify and confirm bugs in the combat pathfinding system.
 *
 * CONFIRMED BUGS:
 * 1. areBordering() has incomplete overlap detection - it only checks SW and NE corners
 *    of entity B against entity A. This fails when B completely contains A or when
 *    the NW/SE corners overlap.
 */
import { describe, expect, it } from "vitest";

import { areBordering, areDiagonal, areOverlapping } from "../src/game/combat/CombatAction";

// =============================================================================
// BUG #1: areBordering() overlap detection is incomplete
// =============================================================================

describe("BUG: areBordering overlap detection is incomplete", () => {
    /**
     * The current areBordering implementation checks overlap like this:
     *
     * ```javascript
     * if ((b.x1 >= a.x1 && b.x1 <= a.x2 && b.z1 >= a.z1 && b.z1 <= a.z2) ||
     *     (b.x2 >= a.x1 && b.x2 <= a.x2 && b.z2 >= a.z1 && b.z2 <= a.z2))
     * ```
     *
     * This only checks:
     * - If SW corner (x1, z1) of B is inside A
     * - If NE corner (x2, z2) of B is inside A
     *
     * It FAILS to check:
     * - If NW corner (x1, z2) of B is inside A
     * - If SE corner (x2, z1) of B is inside A
     * - If B completely surrounds A (none of B's corners are in A)
     * - If A completely surrounds B
     */

    it("CONFIRMED BUG: 3x3 entity surrounding 1x1 entity returns TRUE instead of FALSE", () => {
        // A is 1x1 at (5, 5): occupies tile (5,5)
        // B is 3x3 at (4, 4): occupies tiles (4,4) to (6,6)
        //
        // Visually:
        //   4 5 6
        // 6 B B B
        // 5 B A B   <- A at (5,5) is INSIDE B's footprint
        // 4 B B B
        //
        // These entities OVERLAP - they share tile (5,5)
        // areBordering should return FALSE (overlapping entities are not "bordering")

        const result = areBordering(
            5,
            5,
            1,
            1, // Entity A: 1x1 at (5,5)
            4,
            4,
            3,
            3, // Entity B: 3x3 at (4,4)
        );

        // BUG: Returns TRUE but should return FALSE
        // The overlap check fails because:
        // - b.x1=4 is NOT >= a.x1=5 (first corner check fails)
        // - b.x2=6 is NOT <= a.x2=5 (second corner check fails)
        // Neither corner of B is detected inside A, so overlap isn't detected

        // This test documents the bug - it SHOULD pass when fixed
        expect(result).toBe(false);
    });

    it("Verify areOverlapping correctly detects the same case", () => {
        // Same scenario - areOverlapping should return TRUE
        const result = areOverlapping(5, 5, 1, 1, 4, 4, 3, 3);
        expect(result).toBe(true);
    });

    it("CONFIRMED BUG: Player inside 2x2 NPC at corner tile", () => {
        // NPC is 2x2 at (5, 5): occupies (5,5), (6,5), (5,6), (6,6)
        // Player is 1x1 at (5, 5): same as NPC's SW corner
        //
        // They overlap on tile (5,5)

        const result = areBordering(
            5,
            5,
            1,
            1, // Player at (5,5)
            5,
            5,
            2,
            2, // 2x2 NPC at (5,5)
        );

        // This case DOES work because player's SW corner (5,5) IS inside NPC's bounds
        expect(result).toBe(false); // Correctly returns false (overlapping)
    });

    it("CONFIRMED BUG: SE corner overlap not detected", () => {
        // A is 2x2 at (5, 5): occupies (5,5) to (6,6)
        // B is 2x2 at (6, 4): occupies (6,4), (7,4), (6,5), (7,5)
        //
        // They overlap at tile (6,5):
        //   5 6 7
        // 6 A A .
        // 5 A X B   <- X is overlap at (6,5)
        // 4 . B B
        //
        // B's SE corner (7,4) is not inside A
        // B's NE corner (7,5) is not inside A
        // B's SW corner (6,4) is not inside A
        // B's NW corner (6,5) IS inside A, but areBordering doesn't check NW corner!

        const result = areBordering(5, 5, 2, 2, 6, 4, 2, 2);

        // BUG: May return TRUE instead of FALSE because NW corner (6,5) is not checked
        // areOverlapping correctly handles this:
        expect(areOverlapping(5, 5, 2, 2, 6, 4, 2, 2)).toBe(true);

        // areBordering should also return false for overlapping entities
        expect(result).toBe(false);
    });

    it("areBordering works correctly when entities are truly adjacent", () => {
        // A at (5,5), B at (6,5) - adjacent east, not overlapping
        expect(areBordering(5, 5, 1, 1, 6, 5, 1, 1)).toBe(true);

        // A at (5,5), B at (5,6) - adjacent north, not overlapping
        expect(areBordering(5, 5, 1, 1, 5, 6, 1, 1)).toBe(true);

        // A at (5,5), B at (6,6) - diagonally adjacent
        expect(areBordering(5, 5, 1, 1, 6, 6, 1, 1)).toBe(true);
    });

    it("areBordering correctly returns false when too far apart", () => {
        expect(areBordering(5, 5, 1, 1, 7, 5, 1, 1)).toBe(false); // 2 tiles east
        expect(areBordering(5, 5, 1, 1, 5, 7, 1, 1)).toBe(false); // 2 tiles north
    });
});

// =============================================================================
// areOverlapping verification (this function works correctly)
// =============================================================================

describe("areOverlapping - verification (works correctly)", () => {
    it("detects complete containment", () => {
        expect(areOverlapping(5, 5, 1, 1, 4, 4, 3, 3)).toBe(true);
    });

    it("detects partial overlap", () => {
        expect(areOverlapping(5, 5, 2, 2, 6, 5, 2, 2)).toBe(true);
    });

    it("correctly returns false for adjacent (non-overlapping)", () => {
        expect(areOverlapping(5, 5, 1, 1, 6, 5, 1, 1)).toBe(false);
    });

    it("correctly returns false for distant entities", () => {
        expect(areOverlapping(5, 5, 1, 1, 10, 10, 1, 1)).toBe(false);
    });
});

// =============================================================================
// areDiagonal verification
// =============================================================================

describe("areDiagonal - verification", () => {
    it("detects diagonal positions for 1x1 entities", () => {
        // NE diagonal
        expect(areDiagonal(5, 5, 1, 1, 6, 6, 1, 1)).toBe(true);
        // NW diagonal
        expect(areDiagonal(5, 5, 1, 1, 4, 6, 1, 1)).toBe(true);
        // SE diagonal
        expect(areDiagonal(5, 5, 1, 1, 6, 4, 1, 1)).toBe(true);
        // SW diagonal
        expect(areDiagonal(5, 5, 1, 1, 4, 4, 1, 1)).toBe(true);
    });

    it("returns false for cardinal adjacent", () => {
        expect(areDiagonal(5, 5, 1, 1, 6, 5, 1, 1)).toBe(false);
        expect(areDiagonal(5, 5, 1, 1, 5, 6, 1, 1)).toBe(false);
        expect(areDiagonal(5, 5, 1, 1, 4, 5, 1, 1)).toBe(false);
        expect(areDiagonal(5, 5, 1, 1, 5, 4, 1, 1)).toBe(false);
    });

    it("detects diagonal for 2x2 NPC corners", () => {
        // NPC at (5,5) size 2x2: SW=(5,5), NE=(6,6)
        // Player at (7,7) is diagonally NE of NPC
        expect(areDiagonal(7, 7, 1, 1, 5, 5, 2, 2)).toBe(true);

        // Player at (4,4) is diagonally SW of NPC
        expect(areDiagonal(4, 4, 1, 1, 5, 5, 2, 2)).toBe(true);

        // Player at (7,5) is east of NPC, not diagonal
        expect(areDiagonal(7, 5, 1, 1, 5, 5, 2, 2)).toBe(false);
    });
});

// =============================================================================
// Impact Analysis: How the areBordering bug affects combat
// =============================================================================

describe("Impact Analysis: areBordering bug in combat", () => {
    /**
     * The areBordering bug affects melee combat range checks because
     * isWithinAttackRange() uses areBordering() for melee (range <= 1).
     *
     * When a player is INSIDE a large NPC's footprint:
     * 1. areBordering() incorrectly returns TRUE (bug)
     * 2. isWithinAttackRange() then checks if diagonal
     * 3. If not diagonal, it returns TRUE - player can melee attack!
     *
     * This is WRONG because:
     * - You shouldn't be able to attack from INSIDE an NPC
     * - You need to be ADJACENT (bordering) to attack, not overlapping
     */

    it("demonstrates the melee range check would fail due to areBordering bug", () => {
        // Simulate what isWithinAttackRange does for melee:
        const px = 5,
            pz = 5,
            pawnSize = 1; // Player at (5,5)
        const tx = 4,
            tz = 4,
            targetSize = 3; // 3x3 NPC at (4,4)

        // Step 1: Check if bordering
        const bordering = areBordering(px, pz, pawnSize, pawnSize, tx, tz, targetSize, targetSize);

        // BUG: This returns TRUE even though player is INSIDE NPC
        // Current behavior: bordering = true

        // Step 2: Check if diagonal
        const diagonal = areDiagonal(px, pz, pawnSize, pawnSize, tx, tz, targetSize, targetSize);

        // Player at (5,5) is not on a corner of NPC (4,4)-(6,6), so not diagonal
        expect(diagonal).toBe(false);

        // Step 3: If bordering and not diagonal, isWithinAttackRange returns TRUE
        // With the bug, a player inside an NPC would be considered in melee range!

        // The correct behavior would be:
        // bordering should be FALSE (overlapping, not bordering)
        expect(bordering).toBe(false); // This assertion FAILS due to the bug
    });
});

// =============================================================================
// Suggested Fix
// =============================================================================

describe("Suggested fix for areBordering", () => {
    /**
     * The fix is simple: use areOverlapping() for the overlap check instead
     * of the broken corner-based check.
     *
     * Fixed areBordering would look like:
     *
     * ```javascript
     * export function areBordering(...): boolean {
     *     // Use proper AABB overlap check
     *     if (areOverlapping(x1, z1, width1, length1, x2, z2, width2, length2)) {
     *         return false; // Overlapping entities are not "bordering"
     *     }
     *
     *     // ... rest of distance checks ...
     * }
     * ```
     */

    it("fixed version would work correctly", () => {
        // Simulating fixed behavior
        function fixedAreBordering(
            x1: number,
            z1: number,
            width1: number,
            length1: number,
            x2: number,
            z2: number,
            width2: number,
            length2: number,
        ): boolean {
            const a = { x1, x2: x1 + width1 - 1, z1, z2: z1 + length1 - 1 };
            const b = { x1: x2, x2: x2 + width2 - 1, z1: z2, z2: z2 + length2 - 1 };

            // FIX: Use proper AABB overlap check
            if (areOverlapping(x1, z1, width1, length1, x2, z2, width2, length2)) {
                return false;
            }

            // Check if too far apart
            if (b.x1 > a.x2 + 1) return false;
            if (b.x2 < a.x1 - 1) return false;
            if (b.z1 > a.z2 + 1) return false;
            if (b.z2 < a.z1 - 1) return false;

            return true;
        }

        // Now test the fixed version
        // 3x3 surrounding 1x1 - should NOT be bordering (overlapping)
        expect(fixedAreBordering(5, 5, 1, 1, 4, 4, 3, 3)).toBe(false);

        // Adjacent entities - should be bordering
        expect(fixedAreBordering(5, 5, 1, 1, 6, 5, 1, 1)).toBe(true);

        // Too far apart - should not be bordering
        expect(fixedAreBordering(5, 5, 1, 1, 8, 5, 1, 1)).toBe(false);
    });
});

// =============================================================================
// Additional test: 2x2 overlap scenarios
// =============================================================================

describe("Additional overlap scenarios", () => {
    it("2x2 entities partially overlapping", () => {
        // A at (5,5) size 2x2: (5,5), (6,5), (5,6), (6,6)
        // B at (6,5) size 2x2: (6,5), (7,5), (6,6), (7,6)
        // Overlap at (6,5) and (6,6)

        // areOverlapping correctly detects this
        expect(areOverlapping(5, 5, 2, 2, 6, 5, 2, 2)).toBe(true);

        // areBordering should return false (they overlap)
        // Current bug: The SW corner of B (6,5) might be detected inside A
        // Let's check...
        const result = areBordering(5, 5, 2, 2, 6, 5, 2, 2);

        // SW corner check: b.x1=6 >= a.x1=5 ✓, b.x1=6 <= a.x2=6 ✓,
        //                  b.z1=5 >= a.z1=5 ✓, b.z1=5 <= a.z2=6 ✓
        // This SHOULD detect the overlap! Let's verify:
        expect(result).toBe(false); // Should be false (overlapping)
    });
});
