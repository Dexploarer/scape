import assert from "assert";

import { CombatCategory, getAttackSequences, getDefaultAttackSequences } from "../data/weapons";

function testDefaultStabSwordSequences(): void {
    const sequences = getDefaultAttackSequences(CombatCategory.DAGGER);
    assert.deepStrictEqual(
        sequences,
        { 0: 386, 1: 392, 2: 390, 3: 386 },
        "category 17 should default to the generic stab-sword attack table",
    );
}

function testRegularDaggerUsesStabSwordTable(): void {
    const sequences = getAttackSequences(1205);
    assert.deepStrictEqual(
        sequences,
        { 0: 386, 1: 386, 2: 390, 3: 386 },
        "bronze dagger should use the regular dagger stab/slash animations",
    );

    const poisonedSequences = getAttackSequences(5688);
    assert.deepStrictEqual(
        poisonedSequences,
        { 0: 386, 1: 386, 2: 390, 3: 386 },
        "bronze dagger(p++) should use the regular dagger stab/slash animations",
    );
}

function testDragonDaggerKeepsDragonDaggerTable(): void {
    const baseSequences = getAttackSequences(1215);
    assert.deepStrictEqual(
        baseSequences,
        { 0: 376, 1: 376, 2: 377, 3: 376 },
        "dragon dagger should keep the dragon dagger normal attack animations",
    );

    const poisonedSequences = getAttackSequences(1231);
    assert.deepStrictEqual(
        poisonedSequences,
        { 0: 376, 1: 376, 2: 377, 3: 376 },
        "dragon dagger(p) should keep the dragon dagger normal attack animations",
    );
}

testDefaultStabSwordSequences();
testRegularDaggerUsesStabSwordTable();
testDragonDaggerKeepsDragonDaggerTable();

console.log("Stab sword weapon data tests passed.");
