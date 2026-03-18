import assert from "assert";

import {
    resolveNpcAttackRange,
    resolveNpcAttackType,
    resolvePlayerAttackReach,
    resolvePlayerAttackType,
} from "../src/game/combat/CombatRules";

function testRegularStaffRequiresAutocastForMagicReach(): void {
    const base = {
        combatWeaponCategory: 18, // autocast-capable magic staff
        combatStyleSlot: 1,
        combatSpellId: 3273, // wind strike
        combatWeaponRange: 0,
    };

    assert.strictEqual(
        resolvePlayerAttackType({ ...base, autocastEnabled: false }),
        "melee",
        "magic staff without autocast should resolve as melee",
    );
    assert.strictEqual(
        resolvePlayerAttackReach({ ...base, autocastEnabled: false }),
        1,
        "magic staff without autocast should have melee reach",
    );

    assert.strictEqual(
        resolvePlayerAttackType({ ...base, autocastEnabled: true }),
        "magic",
        "magic staff with autocast should resolve as magic",
    );
    assert.strictEqual(
        resolvePlayerAttackReach({ ...base, autocastEnabled: true }),
        10,
        "magic staff with autocast should use spell range",
    );
}

function testPoweredStaffAlwaysMagic(): void {
    const poweredStaffState = {
        combatWeaponCategory: 24, // powered staves
        combatStyleSlot: 0,
        combatSpellId: -1,
        autocastEnabled: false,
        combatWeaponRange: 0,
    };

    assert.strictEqual(
        resolvePlayerAttackType(poweredStaffState),
        "magic",
        "powered staff should always resolve as magic",
    );
    assert.strictEqual(
        resolvePlayerAttackReach(poweredStaffState),
        10,
        "powered staff should always have magic reach",
    );
}

function testSalamanderStyles(): void {
    const base = {
        combatWeaponCategory: 31, // salamander
        combatSpellId: -1,
        autocastEnabled: false,
        combatWeaponRange: 0,
    };

    assert.strictEqual(
        resolvePlayerAttackType({ ...base, combatStyleSlot: 0 }),
        "melee",
        "salamander style 0 should resolve melee",
    );
    assert.strictEqual(
        resolvePlayerAttackReach({ ...base, combatStyleSlot: 0 }),
        1,
        "salamander style 0 should have melee reach",
    );

    assert.strictEqual(
        resolvePlayerAttackType({ ...base, combatStyleSlot: 1 }),
        "ranged",
        "salamander style 1 should resolve ranged",
    );
    assert.strictEqual(
        resolvePlayerAttackReach({ ...base, combatStyleSlot: 1 }),
        7,
        "salamander style 1 should have ranged reach",
    );

    assert.strictEqual(
        resolvePlayerAttackType({ ...base, combatStyleSlot: 2 }),
        "magic",
        "salamander style 2 should resolve magic",
    );
    assert.strictEqual(
        resolvePlayerAttackReach({ ...base, combatStyleSlot: 2 }),
        10,
        "salamander style 2 should have magic reach",
    );
}

function testRangedLongrangeBonus(): void {
    const rangedState = {
        combatWeaponCategory: 3, // bow
        combatStyleSlot: 2, // longrange
        combatSpellId: -1,
        autocastEnabled: false,
        combatWeaponRange: 7,
    };

    assert.strictEqual(
        resolvePlayerAttackType(rangedState),
        "ranged",
        "ranged weapon should resolve ranged attack type",
    );
    assert.strictEqual(
        resolvePlayerAttackReach(rangedState),
        9,
        "ranged longrange style should add +2 reach",
    );
}

function testNpcAttackResolvers(): void {
    const meleeNpc = {
        combat: { attackType: "melee" as const },
    };
    assert.strictEqual(
        resolveNpcAttackType(meleeNpc),
        "melee",
        "npc resolver should use combat profile melee attack type",
    );
    assert.strictEqual(
        resolveNpcAttackRange(meleeNpc),
        1,
        "melee npc should default to 1 tile attack range",
    );

    const magicNpc = {
        getAttackType: () => "magic" as const,
        combat: { attackType: "melee" as const },
    };
    assert.strictEqual(
        resolveNpcAttackType(magicNpc),
        "magic",
        "npc resolver should prioritize direct attack type when available",
    );
    assert.strictEqual(
        resolveNpcAttackRange(magicNpc),
        10,
        "magic npc should default to 10 tile attack range",
    );

    const rangedWithOverride = {
        attackType: "ranged" as const,
        attackRange: 12,
    };
    assert.strictEqual(
        resolveNpcAttackType(rangedWithOverride),
        "ranged",
        "npc resolver should accept top-level attack type state",
    );
    assert.strictEqual(
        resolveNpcAttackRange(rangedWithOverride),
        12,
        "npc resolver should respect configured attack range override",
    );
}

function main(): void {
    testRegularStaffRequiresAutocastForMagicReach();
    testPoweredStaffAlwaysMagic();
    testSalamanderStyles();
    testRangedLongrangeBonus();
    testNpcAttackResolvers();
    console.log("combat_rules tests passed");
}

main();
