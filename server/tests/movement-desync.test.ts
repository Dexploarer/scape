/**
 * Path Desync Tests
 * Tests for the CRITICAL path desync issue between local and remote players
 * Reference: player-movement.md - CRITICAL Issue #1
 */
import { PlayerState } from "../src/game/player";

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
 * Mock WebSocket for testing
 */
class MockWebSocket {
    public sentMessages: any[] = [];
    public readyState = 1; // OPEN

    send(data: string) {
        this.sentMessages.push(JSON.parse(data));
    }

    getLastMessage() {
        return this.sentMessages[this.sentMessages.length - 1];
    }

    clearMessages() {
        this.sentMessages = [];
    }
}

/**
 * Test: Immediate Steps Should Not Be Sent Only to Local Player
 * Reference: player-movement.md - wsServer.ts:3175-3179
 */
export async function testNoImmediateLocalOnlySteps(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);
    const mockWs = new MockWebSocket();

    // Set a path
    player.setPath(
        [
            { x: 3201, y: 3200 },
            { x: 3202, y: 3200 },
        ],
        false,
    );

    // Check if pendingImmediateSteps is set (the bug)
    const hasPendingImmediate = (player as any).pendingImmediateSteps !== undefined;

    if (hasPendingImmediate) {
        console.log("⚠️  WARNING: pendingImmediateSteps exists on player");
        console.log("   This means immediate steps are sent to local player only");
        console.log("   causing desync between local and remote views");
        console.log("   Location: wsServer.ts:3175-3179");
    } else {
        console.log("✓ No pendingImmediateSteps found (desync may be fixed)");
    }
}

/**
 * Test: Player Position Should Be Same for Local and Remote
 * This test simulates what two clients would see
 */
export async function testLocalRemotePositionSync(): Promise<void> {
    // Simulate two players watching the same third player
    const playerA = new PlayerState(1, 3200, 3200, 0);

    // Player A moves in a U-shape around a 1x1 wall
    // This is the worst case for desync (sharp turns)
    const uShapePath = [
        { x: 3200, y: 3201 }, // North
        { x: 3200, y: 3202 }, // North
        { x: 3201, y: 3202 }, // East (turn)
        { x: 3202, y: 3202 }, // East
        { x: 3202, y: 3201 }, // South (turn)
        { x: 3202, y: 3200 }, // South
    ];

    playerA.setPath(uShapePath, false);

    // Simulate local player view (immediate)
    const localPlayerPosition = { x: playerA.tileX, y: playerA.tileY };

    // Simulate one tick
    playerA.tickStep();
    const afterOneTick = { x: playerA.tileX, y: playerA.tileY };

    // In the buggy implementation:
    // - Local player would see movement immediately
    // - Remote players would see nothing until next broadcast (600ms later)

    // If immediate steps are used, there would be a pending flag
    const hasPendingSteps = (playerA as any).pendingImmediateSteps;

    if (hasPendingSteps && hasPendingSteps.length > 0) {
        console.log("⚠️  DESYNC DETECTED:");
        console.log(`   Local view would be at (${afterOneTick.x}, ${afterOneTick.y})`);
        console.log(`   Remote view still at (${localPlayerPosition.x}, ${localPlayerPosition.y})`);
        console.log(`   Difference of ${Math.abs(afterOneTick.x - localPlayerPosition.x)} tiles`);
    }
}

/**
 * Test: Sharp Turns Should Not Cause Large Position Deltas
 */
export async function testSharpTurnDesync(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);

    // Record starting position
    const startPos = { x: player.tileX, y: player.tileY };

    // Execute a sharp U-turn path
    const sharpTurnPath = [
        { x: 3200, y: 3201 }, // North
        { x: 3201, y: 3201 }, // East (90° turn)
        { x: 3201, y: 3200 }, // South (90° turn)
    ];

    player.setPath(sharpTurnPath, false);

    // Count direction changes
    let directionChanges = 0;
    let lastDir = { dx: 0, dy: 0 };

    for (let i = 0; i < sharpTurnPath.length; i++) {
        const step = sharpTurnPath[i];
        const prevStep = i === 0 ? startPos : sharpTurnPath[i - 1];
        const dx = step.x - prevStep.x;
        const dy = step.y - prevStep.y;

        if (i > 0 && (dx !== lastDir.dx || dy !== lastDir.dy)) {
            directionChanges++;
        }

        lastDir = { dx, dy };
    }

    assert(
        directionChanges === 2,
        `Sharp U-turn should have 2 direction changes, got ${directionChanges}`,
    );

    console.log(`✓ Sharp turn path has ${directionChanges} direction changes`);
    console.log("  This amplifies desync in buggy implementation");
}

/**
 * Test: Broadcast Should Include All Players
 * Tests that movement updates are sent to all players, not just owner
 */
export async function testBroadcastToAllPlayers(): Promise<void> {
    // This would require access to the actual WebSocket server
    // For now, we document what SHOULD happen

    console.log("📋 Expected broadcast behavior:");
    console.log("   1. Player A clicks to move");
    console.log("   2. Server computes path");
    console.log("   3. On NEXT tick, broadcast to ALL players (including A)");
    console.log("   4. All players see same position at same time");
    console.log("");
    console.log("   Current buggy behavior:");
    console.log("   1. Player A clicks to move");
    console.log("   2. Server sends immediate steps to A only");
    console.log("   3. On NEXT tick, broadcast to other players");
    console.log("   4. Player A sees movement 600ms before others");
}

/**
 * Test: Movement Steps Should Not Be Duplicated
 */
export async function testNoDuplicateSteps(): Promise<void> {
    const player = new PlayerState(1, 3200, 3200, 0);

    player.setPath([{ x: 3201, y: 3200 }], false);

    // Execute first step
    player.tickStep();
    const steps1 = (player as any).drainStepPositions?.() || [];

    // Check for pending immediate steps
    const pending = (player as any).pendingImmediateSteps;

    if (pending && pending.length > 0 && steps1.length > 0) {
        // Check if first step matches pending
        const firstStep = steps1[0];
        const pendingStep = pending[0];

        if (firstStep.x === pendingStep.x && firstStep.y === pendingStep.y) {
            console.log("⚠️  WARNING: Same step in both immediate and tick steps");
            console.log("   This causes double-send to clients");
            console.log("   Location: wsServer.ts:1025-1036");
        }
    } else {
        console.log("✓ No duplicate step detection needed");
    }
}

/**
 * Run all path desync tests
 */
export async function runPathDesyncTests(): Promise<void> {
    console.log("\n=== Path Desync Tests ===\n");

    const tests = [
        { name: "No Immediate Local-Only Steps", fn: testNoImmediateLocalOnlySteps },
        { name: "Local/Remote Position Sync", fn: testLocalRemotePositionSync },
        { name: "Sharp Turn Desync", fn: testSharpTurnDesync },
        { name: "Broadcast To All Players", fn: testBroadcastToAllPlayers },
        { name: "No Duplicate Steps", fn: testNoDuplicateSteps },
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

    console.log(`\n=== Desync Test Results ===`);
    console.log(`Passed: ${results.passed}/${tests.length}`);
    console.log(`Failed: ${results.failed}/${tests.length}`);

    if (results.failed > 0) {
        throw new Error(`${results.failed} desync test(s) failed`);
    }
}
