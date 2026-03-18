import assert from "assert";

import type { CacheInfo } from "../../src/rs/cache/CacheInfo";
import { NpcType } from "../../src/rs/config/npctype/NpcType";
import { ByteBuffer } from "../../src/rs/io/ByteBuffer";
import { CombatActionHandler } from "../src/game/actions/handlers/CombatActionHandler";
import { hasProjectileLineOfSightToNpc } from "../src/game/combat/CombatAction";
import { PlayerInteractionSystem } from "../src/game/interactions/PlayerInteractionSystem";
import { NpcState } from "../src/game/npc";
import { NpcManager } from "../src/game/npcManager";
import { PlayerState } from "../src/game/player";

const TEST_CACHE_INFO: CacheInfo = {
    name: "test",
    game: "oldschool",
    environment: "test",
    revision: 235,
    timestamp: "",
    size: 0,
};

function createNpc(
    id: number,
    size: number,
    tileX: number,
    tileY: number,
    options: {
        wanderRadius?: number;
        attackType?: "melee" | "ranged" | "magic";
        attackSpeed?: number;
    } = {},
): NpcState {
    return new NpcState(
        id,
        id,
        size,
        -1,
        -1,
        32,
        { x: tileX, y: tileY, level: 0 },
        {
            wanderRadius: options.wanderRadius ?? 0,
            maxHitpoints: 25,
            attackType: options.attackType,
            attackSpeed: options.attackSpeed ?? 4,
        },
    );
}

function createPlayer(id: number, tileX: number, tileY: number): PlayerState {
    return new PlayerState(id, tileX, tileY, 0);
}

function createPathServiceStub() {
    return {
        findNpcPathStep: () => undefined,
        edgeHasWallBetween: () => false,
        projectileRaycast: () => ({ clear: true, tiles: 0 }),
    };
}

function testLargeNpcEdgeAdjacencySchedulesAttack(): void {
    const manager = new NpcManager({} as any, createPathServiceStub() as any, {} as any, {} as any);
    const npc = createNpc(100, 2, 10, 10, { attackType: "melee", attackSpeed: 4 });
    const player = createPlayer(1, 12, 10);

    (manager as any).npcs.set(npc.id, npc);
    (manager as any).addOccupancyFootprint(npc);

    npc.engageCombat(player.id, 100);
    npc.setNextAttackTick(0);

    const result = manager.tick(100, (playerId) => (playerId === player.id ? player : undefined));
    assert.deepStrictEqual(
        result.aggressionEvents,
        [{ npcId: npc.id, targetPlayerId: player.id }],
        "2x2 NPC should schedule an attack when the player is adjacent to its east edge",
    );
}

function testLargeNpcRoamOccupancyChecksFullFootprint(): void {
    const manager = new NpcManager({} as any, createPathServiceStub() as any, {} as any, {} as any);
    const mover = createNpc(200, 2, 10, 10, { wanderRadius: 2 });
    const blocker = createNpc(201, 2, 12, 10);

    (manager as any).addOccupancyFootprint(mover);
    (manager as any).addOccupancyFootprint(blocker);

    const randomValues = [0.7, 0.5, 0.3, 0.5];
    const originalRandom = Math.random;
    try {
        Math.random = () => randomValues.shift() ?? 0.5;
        const target = (manager as any).pickRandomTarget(mover);
        assert.deepStrictEqual(
            target,
            { x: 9, y: 10 },
            "roam target selection should reject tiles whose footprint overlaps another large NPC",
        );
    } finally {
        Math.random = originalRandom;
    }
}

function testLargeNpcProjectileLosUsesAnyOccupiedTile(): void {
    const npc = createNpc(300, 2, 10, 10, { attackType: "magic", attackSpeed: 4 });
    const player = createPlayer(2, 14, 10);
    const scheduled: any[] = [];
    const rayStarts: Array<{ x: number; y: number }> = [];

    const pathService = {
        projectileRaycast: (
            from: { x: number; y: number; plane: number },
            _to: { x: number; y: number },
        ) => {
            rayStarts.push({ x: from.x, y: from.y });
            return { clear: from.x === 11 && from.y === 10, tiles: 3 };
        },
    };

    const handler = new CombatActionHandler({
        getNpc: (id) => (id === npc.id ? npc : undefined),
        getPathService: () => pathService as any,
        resolveNpcAttackType: () => "magic",
        normalizeAttackType: (value) =>
            value === "melee" || value === "ranged" || value === "magic" ? value : undefined,
        resolveNpcAttackRange: () => 4,
        isWithinAttackRange: () => true,
        hasDirectMeleeReach: () => true,
        hasDirectMeleePath: () => true,
        getNpcCombatSequences: () => undefined,
        broadcastNpcSequence: () => {},
        scheduleAction: (_playerId, request, tick) => {
            scheduled.push({ request, tick });
            return { ok: true };
        },
        rollRetaliateDamage: () => 6,
        isActiveFrame: () => true,
        dispatchActionEffects: () => {},
        log: () => {},
    } as any);

    const result = handler.executeCombatNpcRetaliateAction(
        player,
        { npcId: npc.id, phase: "swing", attackType: "magic", isAggression: true },
        200,
    );

    assert.ok(result.ok, "large NPC ranged swing should succeed when any occupied tile has LoS");
    assert.strictEqual(scheduled.length, 1, "swing should schedule exactly one retaliation hit");
    assert.ok(
        rayStarts.some((start) => start.x === 11 && start.y === 10),
        "LoS should probe beyond the southwest tile for multi-tile NPCs",
    );
}

function testPlayerLargeNpcProjectileLosUsesAnyOccupiedTile(): void {
    const npc = createNpc(301, 2, 10, 10);
    const rayTargets: Array<{ x: number; y: number }> = [];
    const pathService = {
        projectileRaycast: (
            _from: { x: number; y: number; plane: number },
            to: { x: number; y: number },
        ) => {
            rayTargets.push({ x: to.x, y: to.y });
            return { clear: to.x === 11 && to.y === 10, tiles: 3 };
        },
    };

    const clear = hasProjectileLineOfSightToNpc(14, 10, 0, npc, pathService as any);
    assert.strictEqual(
        clear,
        true,
        "player projectile LoS should succeed when any occupied NPC tile is visible",
    );
    assert.ok(
        rayTargets.some((tile) => tile.x === 11 && tile.y === 10),
        "player projectile LoS should test occupied tiles beyond the southwest corner",
    );
}

function testPlayerRouteToLineOfSightUsesAnyOccupiedTile(): void {
    const npc = createNpc(302, 2, 10, 10);
    const player = createPlayer(3, 14, 10);
    const routeAttempts: Array<{ x: number; y: number }> = [];
    const rayChecks: Array<{ fromX: number; fromY: number; toX: number; toY: number }> = [];
    const pathService = {
        projectileRaycast: (
            from: { x: number; y: number; plane: number },
            to: { x: number; y: number },
        ) => {
            rayChecks.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });
            return {
                clear: from.x === 15 && from.y === 10 && to.x === 11 && to.y === 10,
                tiles: 4,
            };
        },
        getCollisionFlagAt: () => 0,
        findPathSteps: (
            req: { from: { x: number; y: number; plane: number }; to: { x: number; y: number } },
            _opts?: any,
        ) => {
            routeAttempts.push({ x: req.to.x, y: req.to.y });
            if (req.to.x === 15 && req.to.y === 10) {
                return { ok: true, steps: [{ x: 15, y: 10 }] };
            }
            return { ok: false, steps: [] };
        },
    };
    const players = {
        get: () => undefined,
        getById: () => undefined,
        getSocketByPlayerId: () => undefined,
        forEach: () => {},
        forEachBot: () => {},
    };

    const interactions = new PlayerInteractionSystem(players as any, pathService as any);
    (interactions as any).isWithinAttackDistance = () => true;
    (interactions as any).isTileWalkable = () => true;

    const routed = (interactions as any).tryRouteToLineOfSight(player, npc, 4, false);
    assert.strictEqual(
        routed,
        true,
        "LoS path search should accept a candidate tile that can see any occupied NPC tile",
    );
    assert.deepStrictEqual(
        routeAttempts[0],
        { x: 15, y: 10 },
        "LoS routing should choose the first reachable tile with visibility to the large NPC",
    );
    assert.ok(
        rayChecks.some(
            (check) =>
                check.fromX === 15 && check.fromY === 10 && check.toX === 11 && check.toY === 10,
        ),
        "LoS routing should raycast against occupied tiles beyond the southwest corner",
    );
}

function testNpcTypeFootprintDefaultsAndOpcode126(): void {
    const fallbackType = new NpcType(1, TEST_CACHE_INFO);
    fallbackType.decode(new ByteBuffer(Int8Array.from([12, 2, 0])));
    fallbackType.post();
    assert.strictEqual(
        fallbackType.footprintSize,
        102,
        "NpcType.post should derive the deob default footprintSize from tile size",
    );

    const explicitType = new NpcType(2, TEST_CACHE_INFO);
    explicitType.decode(new ByteBuffer(Int8Array.from([12, 2, 126, 0, 140, 0])));
    explicitType.post();
    assert.strictEqual(
        explicitType.footprintSize,
        140,
        "NpcType should preserve explicit opcode 126 footprintSize values",
    );
}

testLargeNpcEdgeAdjacencySchedulesAttack();
testLargeNpcRoamOccupancyChecksFullFootprint();
testLargeNpcProjectileLosUsesAnyOccupiedTile();
testPlayerLargeNpcProjectileLosUsesAnyOccupiedTile();
testPlayerRouteToLineOfSightUsesAnyOccupiedTile();
testNpcTypeFootprintDefaultsAndOpcode126();

console.log("Large NPC footprint parity tests passed.");
