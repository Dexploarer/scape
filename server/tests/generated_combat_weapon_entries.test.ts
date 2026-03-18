import assert from "assert";

import { CombatCategory, getAttackSequences, getCombatStyle, getWeaponData } from "../data/weapons";

function testGeneratedTwoHandedWeapon(): void {
    const itemId = 12426; // 3rd age longsword
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "3rd age longsword should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.TWO_HANDED_SWORD,
        "3rd age longsword should use the two-handed sword category",
    );
}

function testGeneratedAxe(): void {
    const itemId = 20011; // 3rd age axe
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "3rd age axe should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.AXE,
        "3rd age axe should use axe category",
    );
}

function testGeneratedPolestaffRow(): void {
    const itemId = 20251; // Arceuus banner
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "Arceuus banner should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.POLESTAFF,
        "Arceuus banner should use the row 13 polestaff/banner category",
    );
    const blockStyle = getCombatStyle(itemId, 3);
    assert.strictEqual(blockStyle.name, "Block", "Arceuus banner slot 3 should be Block");
    assert.strictEqual(
        blockStyle.attackType,
        "crush",
        "Arceuus banner block style should defend vs crush row",
    );
}

function testGeneratedPartisanRow(): void {
    const itemId = 25979; // Keris partisan
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "Keris partisan should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.PARTISAN,
        "Keris partisan should use partisan category 30",
    );
    const poundStyle = getCombatStyle(itemId, 2);
    assert.strictEqual(poundStyle.name, "Pound", "Keris partisan slot 2 should be Pound");
    assert.strictEqual(poundStyle.attackType, "crush", "Keris partisan slot 2 should be crush");
    const sequences = getAttackSequences(itemId);
    assert.deepStrictEqual(
        sequences,
        { 0: 386, 1: 392, 2: 401, 3: 386 },
        "Keris partisan should use generated partisan attack sequences",
    );
}

function testGeneratedUnarmedItem(): void {
    const itemId = 20056; // Ale of the gods
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "Ale of the gods should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.UNARMED,
        "Ale of the gods should use unarmed category",
    );
}

function testGeneratedGunRow(): void {
    const itemId = 6082; // Fixed device
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "Fixed device should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.GUN,
        "Fixed device should use gun category",
    );
    const fireStyle = getCombatStyle(itemId, 0);
    assert.strictEqual(
        fireStyle.name,
        "Aim and Fire",
        "Fixed device slot 0 should be Aim and Fire",
    );
}

function testGeneratedWhipVariant(): void {
    const itemId = 26484; // Abyssal tentacle (or)
    const weapon = getWeaponData(itemId);
    assert.ok(weapon, "Abyssal tentacle (or) should have generated weapon data");
    assert.strictEqual(
        weapon?.combatCategory,
        CombatCategory.WHIP,
        "Abyssal tentacle (or) should use whip category",
    );
}

testGeneratedTwoHandedWeapon();
testGeneratedAxe();
testGeneratedPolestaffRow();
testGeneratedPartisanRow();
testGeneratedUnarmedItem();
testGeneratedGunRow();
testGeneratedWhipVariant();

console.log("Generated combat weapon entry tests passed.");
