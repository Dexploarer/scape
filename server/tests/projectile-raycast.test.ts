/**
 * Projectile Raycast Tests
 * Tests for line-of-sight collision checks for ranged/magic attacks.
 */
import { PathService } from "../src/pathfinding/PathService";
import { CollisionFlag } from "../src/pathfinding/legacy/pathfinder/flag/CollisionFlag";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Mock MapCollisionService for testing
 */
class MockMapCollisionService {
    private flags: Map<string, number> = new Map();

    private makeKey(x: number, y: number, plane: number): string {
        return `${plane}:${x}:${y}`;
    }

    setFlag(x: number, y: number, plane: number, flag: number): void {
        this.flags.set(this.makeKey(x, y, plane), flag);
    }

    getTileMinLevelAt(_x: number, _y: number, _plane: number): number | undefined {
        // Always return the same plane (no bridges/tunnels in tests)
        return undefined;
    }

    getMapSquare(mapX: number, mapY: number): any {
        const baseX = mapX * 64;
        const baseY = mapY * 64;
        const self = this;
        return {
            baseX,
            baseY,
            size: 64,
            collisionMaps: [
                {
                    isWithinBounds: () => true,
                    getFlag: (localX: number, localY: number) => {
                        return self.flags.get(self.makeKey(baseX + localX, baseY + localY, 0)) ?? 0;
                    },
                },
                null,
                null,
                null,
            ],
        };
    }
}

function createTestPathService(): { pathService: PathService; mockMap: MockMapCollisionService } {
    const mockMap = new MockMapCollisionService();
    const pathService = new PathService(mockMap as any, 128);
    return { pathService, mockMap };
}

/**
 * Test: Clear path returns true with correct tile count
 */
export async function testClearPathReturnsTrue(): Promise<void> {
    const { pathService } = createTestPathService();

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3205, y: 3200 },
    );

    assert(result.clear === true, "Expected clear path for unobstructed raycast");
    assert(result.tiles === 5, `Expected 5 tiles traveled, got ${result.tiles}`);
}

/**
 * Test: Same position returns clear with 0 tiles
 */
export async function testSamePositionReturnsClear(): Promise<void> {
    const { pathService } = createTestPathService();

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3200, y: 3200 },
    );

    assert(result.clear === true, "Expected clear for same position");
    assert(result.tiles === 0, `Expected 0 tiles, got ${result.tiles}`);
}

/**
 * Test: Wall east projectile blocker blocks eastward raycast
 */
export async function testWallEastBlocksEastwardRaycast(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Place a wall on the east side of tile (3200, 3200)
    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3205, y: 3200 },
    );

    assert(result.clear === false, "Expected blocked path when wall is in the way");
}

/**
 * Test: Wall west projectile blocker blocks westward raycast
 */
export async function testWallWestBlocksWestwardRaycast(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Place a wall on the west side of tile (3200, 3200)
    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3195, y: 3200 },
    );

    assert(result.clear === false, "Expected blocked path when wall is in the way");
}

/**
 * Test: Wall north projectile blocker blocks northward raycast
 */
export async function testWallNorthBlocksNorthwardRaycast(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3200, y: 3205 },
    );

    assert(result.clear === false, "Expected blocked path when north wall is in the way");
}

/**
 * Test: Wall south projectile blocker blocks southward raycast
 */
export async function testWallSouthBlocksSouthwardRaycast(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3200, y: 3195 },
    );

    assert(result.clear === false, "Expected blocked path when south wall is in the way");
}

/**
 * Test: Object projectile blocker blocks raycast through object
 */
export async function testObjectBlocksRaycast(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Place a blocking object at (3202, 3200)
    mockMap.setFlag(3202, 3200, 0, CollisionFlag.OBJECT_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3205, y: 3200 },
    );

    assert(result.clear === false, "Expected blocked path when object is in the way");
}

/**
 * Test: Diagonal raycast blocked by NE corner wall
 */
export async function testDiagonalNEBlocked(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Place NE corner wall at source tile
    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_NORTH_EAST_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3203, y: 3203 }, // NE diagonal
    );

    assert(result.clear === false, "Expected blocked path for NE diagonal with corner wall");
}

/**
 * Test: Diagonal raycast blocked by SW corner wall on destination
 */
export async function testDiagonalBlockedByDestinationWall(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Place SW corner wall at destination tile
    mockMap.setFlag(3201, 3201, 0, CollisionFlag.WALL_SOUTH_WEST_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3201, y: 3201 }, // NE diagonal to destination
    );

    assert(result.clear === false, "Expected blocked path when destination has blocking wall");
}

/**
 * Test: Diagonal movement requires intermediate cardinal clearance
 * (Can't cut corners through walls)
 */
export async function testDiagonalRequiresCardinalClearance(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Block the intermediate north step, not the diagonal itself
    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3201, y: 3201 }, // NE diagonal
    );

    assert(result.clear === false, "Expected blocked path when intermediate cardinal is blocked");
}

/**
 * Test: Long diagonal raycast works correctly
 */
export async function testLongDiagonalRaycast(): Promise<void> {
    const { pathService } = createTestPathService();

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3210, y: 3210 }, // 10 tiles diagonal
    );

    assert(result.clear === true, "Expected clear path for unobstructed diagonal");
    // Bresenham diagonal: each step goes +1,+1 so 10 tiles
    assert(result.tiles === 10, `Expected 10 tiles, got ${result.tiles}`);
}

/**
 * Test: Non-blocking walls don't affect projectiles
 */
export async function testNonProjectileWallsDontBlock(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Place a regular movement wall (not projectile blocker)
    mockMap.setFlag(3200, 3200, 0, CollisionFlag.WALL_EAST);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3205, y: 3200 },
    );

    assert(result.clear === true, "Movement walls should not block projectiles");
}

/**
 * Test: Tile count correct for blocked path
 */
export async function testTileCountOnBlockedPath(): Promise<void> {
    const { pathService, mockMap } = createTestPathService();

    // Block at third tile
    mockMap.setFlag(3202, 3200, 0, CollisionFlag.OBJECT_PROJECTILE_BLOCKER);

    const result = pathService.projectileRaycast(
        { x: 3200, y: 3200, plane: 0 },
        { x: 3210, y: 3200 },
    );

    assert(result.clear === false, "Expected blocked path");
    // Should have traveled 1 tile before hitting the blocker at tile 2
    // (starting at 3200, step to 3201 is 1 tile, then blocked going to 3202)
    assert(result.tiles === 1, `Expected 1 tile traveled before block, got ${result.tiles}`);
}

// Run all tests
export async function runAllTests(): Promise<void> {
    const tests = [
        testClearPathReturnsTrue,
        testSamePositionReturnsClear,
        testWallEastBlocksEastwardRaycast,
        testWallWestBlocksWestwardRaycast,
        testWallNorthBlocksNorthwardRaycast,
        testWallSouthBlocksSouthwardRaycast,
        testObjectBlocksRaycast,
        testDiagonalNEBlocked,
        testDiagonalBlockedByDestinationWall,
        testDiagonalRequiresCardinalClearance,
        testLongDiagonalRaycast,
        testNonProjectileWallsDontBlock,
        testTileCountOnBlockedPath,
    ];

    console.log(`Running ${tests.length} projectile raycast tests...\n`);
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test();
            console.log(`✓ ${test.name}`);
            passed++;
        } catch (error) {
            console.log(`✗ ${test.name}`);
            console.log(`  ${(error as Error).message}\n`);
            failed++;
        }
    }

    console.log(`\n${passed}/${tests.length} tests passed`);
    if (failed > 0) {
        process.exit(1);
    }
}

// Auto-run if executed directly
if (require.main === module) {
    runAllTests().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
