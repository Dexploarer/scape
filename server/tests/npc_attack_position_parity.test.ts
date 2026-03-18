import assert from "assert";

import { CombatActionHandler } from "../src/game/actions/handlers/CombatActionHandler";
import { canNpcAttackPlayerFromCurrentPosition } from "../src/game/combat/CombatAction";
import { NpcState } from "../src/game/npc";
import { NpcManager } from "../src/game/npcManager";
import { PlayerState } from "../src/game/player";

function createNpc(
    id: number,
    tileX: number,
    tileY: number,
    options: {
        size?: number;
        attackType?: "melee" | "ranged" | "magic";
        attackSpeed?: number;
    } = {},
): NpcState {
    return new NpcState(
        id,
        id,
        options.size ?? 1,
        -1,
        -1,
        32,
        { x: tileX, y: tileY, level: 0 },
        {
            wanderRadius: 0,
            maxHitpoints: 25,
            attackType: options.attackType ?? "melee",
            attackSpeed: options.attackSpeed ?? 4,
        },
    );
}

function createPlayer(id: number, tileX: number, tileY: number): PlayerState {
    return new PlayerState(id, tileX, tileY, 0);
}

function createBlockingPathService() {
    return {
        findNpcPathStep: () => undefined,
        edgeHasWallBetween: () => false,
        projectileRaycast: () => ({ clear: true, tiles: 0 }),
    };
}

function normalizeAttackType(value: unknown): "melee" | "ranged" | "magic" | undefined {
    return value === "melee" || value === "ranged" || value === "magic" ? value : undefined;
}

function testSharedValidatorRejectsDiagonalMelee(): void {
    const npc = createNpc(100, 10, 10);
    const player = createPlayer(1, 11, 11);

    const canAttack = canNpcAttackPlayerFromCurrentPosition(npc, player, 1, "melee", {
        pathService: createBlockingPathService() as any,
    });

    assert.strictEqual(canAttack, false, "diagonal melee tiles must not count as attackable");
}

function testNpcRetaliateSwingRejectsDiagonalMelee(): void {
    const npc = createNpc(200, 10, 10);
    const player = createPlayer(2, 11, 11);

    const handler = new CombatActionHandler({
        getNpc: (id) => (id === npc.id ? npc : undefined),
        getPathService: () => createBlockingPathService() as any,
        resolveNpcAttackType: (_npc, explicit) => explicit ?? "melee",
        normalizeAttackType,
        resolveNpcAttackRange: () => 1,
        isWithinAttackRange: () => true,
        hasDirectMeleeReach: () => true,
        hasDirectMeleePath: () => true,
        getNpcCombatSequences: () => undefined,
        broadcastNpcSequence: () => {},
        scheduleAction: () => {
            throw new Error("diagonal melee swing must not enqueue a hit");
        },
        rollRetaliateDamage: () => 1,
        isActiveFrame: () => true,
        dispatchActionEffects: () => {},
        log: () => {},
    } as any);

    const result = handler.executeCombatNpcRetaliateAction(
        player,
        { npcId: npc.id, phase: "swing", attackType: "melee", isAggression: true },
        200,
    );

    assert.strictEqual(result.ok, false, "diagonal melee retaliation swing should be rejected");
    assert.strictEqual(result.reason, "not_in_range");
}

function testNpcManagerDoesNotScheduleDiagonalMeleeAttackWithoutCorrection(): void {
    const pathService = createBlockingPathService();
    const manager = new NpcManager({} as any, pathService as any, {} as any, {} as any);
    const npc = createNpc(300, 10, 10);
    const player = createPlayer(3, 11, 11);

    (manager as any).npcs.set(npc.id, npc);
    (manager as any).addOccupancyFootprint(npc);

    npc.engageCombat(player.id, 100);
    npc.setNextAttackTick(0);

    const result = manager.tick(100, (playerId) => (playerId === player.id ? player : undefined));

    assert.deepStrictEqual(
        result.aggressionEvents,
        [],
        "npc manager should not schedule an attack from diagonal melee range",
    );
    assert.strictEqual(
        npc.getNextAttackTick(),
        0,
        "failed diagonal melee swing should not advance the npc attack timer",
    );
}

testSharedValidatorRejectsDiagonalMelee();
testNpcRetaliateSwingRejectsDiagonalMelee();
testNpcManagerDoesNotScheduleDiagonalMeleeAttackWithoutCorrection();

console.log("NPC attack position parity tests passed.");
