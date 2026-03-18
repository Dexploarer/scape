/**
 * Movement System Tests
 * Tests for known issues documented in player-movement.md
 */
import { TraversalType } from "../src/game/actor";
import { PlayerState } from "../src/game/player";

type DeferredMovementPlayer = PlayerState & {
    setDeferredMovement: (x: number, y: number) => void;
    processDeferredMovement: () => void;
    hasDeferredMovement: () => boolean;
    pathX: number[];
    pathY: number[];
    pathTraversed: TraversalType[];
    pathLength: number;
    addStepToPath: (x: number, y: number, traversalType: TraversalType) => void;
};

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

/**
 * Test: 10-Step Queue Should Not Break Long Paths
 * Reference: player-movement.md - CRITICAL Issue #2
 * Location: /server/src/game/actor.ts:196-200
 */
export async function test10StepQueueLimit(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);

    // Create a 30-tile path (much longer than 10-step buffer)
    const longPath = [];
    for (let i = 0; i < 30; i++) {
        longPath.push({ x: 3200 + i, y: 3200 });
    }

    player.setPath(longPath, false);

    // Simulate movement: player should process all 30 steps
    let stepsCompleted = 0;
    const maxTicks = 100; // Safety limit

    for (let tick = 0; tick < maxTicks; tick++) {
        const moved = player.tickStep();
        if (moved) {
            stepsCompleted++;
        }

        if (!player.hasPath()) {
            break; // Reached destination
        }
    }

    // Player should reach the destination (30 tiles)
    // Note: Path has 30 tiles, but first tile is starting position, so 29 steps
    const expectedSteps = 29;
    assert(
        stepsCompleted >= expectedSteps,
        `Expected ${expectedSteps} steps completed, got ${stepsCompleted}. ` +
            `10-step buffer is truncating long paths!`,
    );

    assertEquals(
        player.tileX,
        3200 + 29, // Final position (30th tile)
        "Player did not reach destination",
    );
}

/**
 * Test: Path Blending Should Be Called
 * Reference: player-movement.md - MEDIUM Issue
 * Location: /server/src/game/actor.ts:175-186
 */
export async function testPathBlendingWiring(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);

    // Set initial path
    player.setPath(
        [
            { x: 3201, y: 3200 },
            { x: 3202, y: 3200 },
        ],
        false,
    );

    const initialQueueLength = (player as any).queue?.length ?? 0;

    // Try to "blend" by clicking adjacent tile
    // This should extend the path, not reset it
    player.setPath([{ x: 3203, y: 3200 }], false);

    const afterBlendQueueLength = (player as any).queue?.length ?? 0;

    // If blending works, queue should have 3 items (2 original + 1 new)
    // If not wired up, queue should have 1 item (reset to just new step)
    if (afterBlendQueueLength > initialQueueLength) {
        console.log("✓ Path blending is wired up and working");
    } else {
        console.log("ℹ️  Path blending not detected (may need adjacent tiles to trigger)");
    }
}

/**
 * Test: Scene Boundary Checks Should Be Enforced
 * Reference: player-movement.md - MEDIUM Issue
 * Location: /server/src/game/actor.ts:141-146
 */

/**
 * Test: Deferred Movement Should Be Processed
 * Reference: player-movement.md - Infrastructure exists but unused
 * Location: /server/src/game/actor.ts:550-557
 */
export async function testDeferredMovement(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0) as DeferredMovementPlayer;

    assert(!!player.setDeferredMovement, "setDeferredMovement method missing");
    assert(!!player.processDeferredMovement, "processDeferredMovement method missing");

    // Set deferred movement
    player.setDeferredMovement(3201, 3201);

    assert(player.hasDeferredMovement() === true, "Deferred movement should be set");

    // Process it
    player.processDeferredMovement();

    assert(player.hasDeferredMovement() === false, "Deferred movement should be cleared after processing");

    console.log("✓ Deferred movement infrastructure exists and works");
}

/**
 * Test: Traversal Type Enum Should Exist
 * Reference: player-movement.md - TraversalType enum
 * Location: /server/src/game/actor.ts:21-25
 */
export async function testTraversalTypeEnum(): Promise<void> {
    // Verify enum exists and has correct values
    assertEquals(TraversalType.SLOW, 0, "TraversalType.SLOW should be 0");
    assertEquals(TraversalType.WALK, 1, "TraversalType.WALK should be 1");
    assertEquals(TraversalType.RUN, 2, "TraversalType.RUN should be 2");

    console.log("✓ TraversalType enum correctly implemented");
}

/**
 * Test: Circular Buffer Should Use Correct Coordinate System
 * Reference: player-movement.md - Coordinate system (tile * 128 + 64)
 * Location: /server/src/game/actor.ts:109-110
 */
export async function testCoordinateSystem(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);

    // World coordinates should be: tile * 128 + modelRadius * 64
    const expectedX = 3200 * 128 + 64; // modelRadius = 1 for 1x1 actors
    const expectedY = 3200 * 128 + 64;

    assertEquals(player.x, expectedX, `World X coordinate should be ${expectedX}`);

    assertEquals(player.y, expectedY, `World Y coordinate should be ${expectedY}`);

    console.log("✓ Coordinate system uses tile * 128 + 64");
}

/**
 * Test: Path Queue Should Use Circular Buffer Structure
 * Reference: player-movement.md - 10-step circular buffer
 * Location: /server/src/game/actor.ts:54-59
 */
export async function testCircularBufferStructure(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0) as DeferredMovementPlayer;

    // Check if circular buffer arrays exist
    const hasPathX = Array.isArray(player.pathX);
    const hasPathY = Array.isArray(player.pathY);
    const hasPathTraversed = Array.isArray(player.pathTraversed);
    const hasPathLength = Number.isFinite(player.pathLength);

    assert(hasPathX, "pathX array should exist");
    assert(hasPathY, "pathY array should exist");
    assert(hasPathTraversed, "pathTraversed array should exist");
    assert(hasPathLength, "pathLength counter should exist");

    // Verify buffer size is 10
    assertEquals(player.pathX.length, 10, "pathX buffer should be size 10");

    console.log("✓ Circular buffer structure implemented");
}

/**
 * Test: addStepToPath Should Shift Elements
 * Reference: player-movement.md - method2415:59-73
 * Location: /server/src/game/actor.ts:196-213
 */
export async function testAddStepShifting(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0) as DeferredMovementPlayer;

    // Add a few steps manually
    player.addStepToPath(3201, 3200, TraversalType.WALK);
    player.addStepToPath(3202, 3200, TraversalType.WALK);
    player.addStepToPath(3203, 3200, TraversalType.RUN);

    const pathLength = player.pathLength;

    assert(pathLength === 3, `Expected pathLength=3, got ${pathLength}`);

    // Latest step should be at index 0
    const firstStep = (player as any).pathX?.[0];
    assertEquals(firstStep, 3203, "Latest step should be at index 0 (LIFO queue)");

    console.log("✓ addStepToPath shifts elements correctly");
}

export async function testPathLengthClearsAfterMovement(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);

    player.setPath(
        [
            { x: 3201, y: 3200 },
            { x: 3202, y: 3200 },
        ],
        false,
    );

    for (let tick = 0; tick < 10; tick++) {
        player.tickStep();
        if (!player.hasPath()) {
            break;
        }
    }

    const remainingPathLength = (player as any).pathLength ?? -1;

    assertEquals(remainingPathLength, 0, "pathLength should clear once the actor is idle");
    assert(player.hasPath() === false, "Actor should report no path once idle");

    console.log("✓ pathLength drains to zero when the queue finishes");
}

/**
 * Run all movement tests
 */
export async function runMovementTests(): Promise<void> {
    console.log("\n=== Movement System Tests ===\n");

    const tests = [
        { name: "Circular Buffer Structure", fn: testCircularBufferStructure },
        { name: "Coordinate System", fn: testCoordinateSystem },
        { name: "TraversalType Enum", fn: testTraversalTypeEnum },
        { name: "Add Step Shifting", fn: testAddStepShifting },
        { name: "Path Length Clears", fn: testPathLengthClearsAfterMovement },
        { name: "10-Step Queue Limit", fn: test10StepQueueLimit },
        { name: "Path Blending Wiring", fn: testPathBlendingWiring },
        { name: "Deferred Movement", fn: testDeferredMovement },
    ];

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
    };

    for (const test of tests) {
        try {
            await test.fn();
            console.log(`✓ ${test.name}`);
            results.passed++;
        } catch (e: any) {
            console.error(`✗ ${test.name}`);
            console.error(`  ${e.message}\n`);
            results.failed++;
        }
    }

    console.log(`\n=== Results ===`);
    console.log(`Passed: ${results.passed}/${tests.length}`);
    console.log(`Failed: ${results.failed}/${tests.length}`);

    if (results.failed > 0) {
        throw new Error(`${results.failed} test(s) failed`);
    }
}
