import assert from "assert";

import { EquipmentSlot } from "../../src/rs/config/player/Equipment";
import { HITMARK_BLOCK, HITMARK_DAMAGE } from "../src/game/combat/HitEffects";
import { DEFAULT_EQUIP_SLOT_COUNT } from "../src/game/equipment";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import { CombatEngine } from "../src/game/systems/combat/CombatEngine";

function createPlayer(): PlayerState {
    const player = new PlayerState(1, 3222, 3221, 0);
    // Mimic minimal appearance data so resolveBlockSequence can inspect weapon slot.
    (player as any).appearance = { equip: new Array(DEFAULT_EQUIP_SLOT_COUNT).fill(-1) };
    return player;
}

function createNpc(): NpcState {
    return new NpcState(42, 0, 1, -1, -1, 32, { x: 3222, y: 3222, level: 0 }, { maxHitpoints: 25 });
}

function testDeterministicAttackPlanning(): void {
    const player = createPlayer();
    const npc = createNpc();

    const engineA = new CombatEngine({ seed: 12345 });
    const planA = engineA.planPlayerAttack({ player, npc, attackSpeed: 4 });

    const engineB = new CombatEngine({ seed: 12345 });
    const planB = engineB.planPlayerAttack({ player, npc, attackSpeed: 4 });

    assert.deepStrictEqual(
        planB,
        planA,
        "player attack planning should be deterministic for identical seeds",
    );

    assert.strictEqual(planA.attackDelay, 4, "attackDelay should preserve requested speed");
    assert.strictEqual(planA.hitDelay, 1, "default melee hit delay should be 1 tick");
    assert.strictEqual(
        planA.retaliationDelay,
        1,
        "default NPC retaliation hit delay should be 1 tick",
    );
    assert.ok(planA.damage >= 0, "damage should never be negative");
    if (planA.hitLanded) {
        assert.strictEqual(planA.style, HITMARK_DAMAGE, "successful hits use damage style");
        assert.ok(planA.damage > 0, "successful hits should deal positive damage");
    } else {
        assert.strictEqual(planA.style, HITMARK_BLOCK, "missed hits use block style");
        assert.strictEqual(planA.damage, 0, "blocked hits should deal zero damage");
    }

    const engineC = new CombatEngine({ seed: 67890 });
    const planC = engineC.planPlayerAttack({ player, npc, attackSpeed: 4 });
    const differs =
        planC.hitLanded !== planA.hitLanded ||
        planC.damage !== planA.damage ||
        planC.retaliationDamage !== planA.retaliationDamage;
    assert.ok(differs, "different seeds should yield different random outcomes");
}

function testNpcRetaliationPlan(): void {
    const player = createPlayer();
    const npc = createNpc();
    const engine = new CombatEngine({ seed: 999 });

    const plan = engine.planNpcRetaliation({ player, npc, attackSpeed: 4 });
    assert.ok(plan.damage >= 1 && plan.damage <= 6, "retaliation damage should be 1-6 inclusive");
    // NPC retaliation hit delay is measured from swing to impact.
    // Melee defaults to 1 tick; ranged/magic include projectile travel.
    assert.ok(
        plan.hitDelay >= 1 && plan.hitDelay <= 10,
        "npc hit delay should be valid range (>=1)",
    );
    assert.strictEqual(plan.style, HITMARK_DAMAGE, "npc retaliation should use damage style");
}

function testEquipmentInfluencesDamage(): void {
    const player = createPlayer();
    const npc = createNpc();

    const riggedRandom = {
        next: () => 0, // always hit
        nextInt: (_min: number, max: number) => max - 1, // return highest possible damage
    };

    const baselineEngine = new CombatEngine({ random: riggedRandom });
    const baselinePlan = baselineEngine.planPlayerAttack({ player, npc, attackSpeed: 4 });
    assert.ok(
        baselinePlan.damage >= 1,
        "baseline damage should be at least 1 when max rolling without gear",
    );

    // Equip a high-strength weapon to boost max hit.
    (player as any).appearance.equip[EquipmentSlot.WEAPON] = 11802; // Armadyl godsword
    const gearedEngine = new CombatEngine({ random: riggedRandom });
    const gearedPlan = gearedEngine.planPlayerAttack({ player, npc, attackSpeed: 4 });

    assert.ok(
        gearedPlan.damage >= baselinePlan.damage,
        "equipping stronger gear should not reduce max damage",
    );
    assert.ok(
        gearedPlan.damage > baselinePlan.damage,
        "equipping stronger gear should increase maximum damage with identical RNG",
    );
}

function testResolveBlockSequence(): void {
    const player = createPlayer();
    const weaponId = 1234;
    (player as any).appearance.equip[EquipmentSlot.WEAPON] = weaponId;

    const weaponData = new Map<number, Record<string, number>>([[weaponId, { block: 555 }]]);
    const equip = (player as any).appearance.equip as number[];
    assert.strictEqual(
        equip[EquipmentSlot.WEAPON],
        weaponId,
        "weapon slot should hold the equipped weapon id",
    );
    assert.ok(weaponData.has(weaponId), "weapon override map should contain the weapon id");
    const engine = new CombatEngine({ seed: 1 });

    const seq = engine.resolveBlockSequence(player, weaponData);
    assert.strictEqual(seq, 555, "block sequence should read weapon override");

    (player as any).appearance.equip[EquipmentSlot.WEAPON] = -1;
    const fallback = engine.resolveBlockSequence(player, weaponData);
    assert.strictEqual(fallback, -1, "missing weapon should return default block sequence");
}

testDeterministicAttackPlanning();
testNpcRetaliationPlan();
testEquipmentInfluencesDamage();
testResolveBlockSequence();

console.log("Combat engine tests passed.");
