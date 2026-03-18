import assert from "assert";

import { CombatCategory, getAttackSequences, getWeaponData, isMeleeWeapon } from "../data/weapons";

const ECHO_AXE = 25110;

function testEchoAxeWeaponData(): void {
    const weapon = getWeaponData(ECHO_AXE);
    assert.ok(weapon, "echo axe should have weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.AXE,
        "echo axe should use axe combat category",
    );
    assert.strictEqual(weapon?.attackSpeed, 5, "echo axe should attack at normal axe speed");
    assert.strictEqual(isMeleeWeapon(ECHO_AXE), true, "echo axe should be treated as melee");

    const sequences = getAttackSequences(ECHO_AXE);
    assert.deepStrictEqual(
        sequences,
        { 0: 395, 1: 395, 2: 401, 3: 395 },
        "echo axe should use standard axe attack sequences",
    );
}

testEchoAxeWeaponData();

console.log("Echo axe weapon data tests passed.");
