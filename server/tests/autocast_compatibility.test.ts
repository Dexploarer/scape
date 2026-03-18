import assert from "assert";

import { canWeaponAutocastSpell, getAutocastCompatibilityMessage } from "../src/data/spells";

(function testStandardWeaponCannotAutocastCombatSpells() {
    const result = canWeaponAutocastSpell(4587, 3273);
    assert.strictEqual(result.compatible, false);
    assert.strictEqual(result.reason, "not_autocastable_with_weapon");
    assert.strictEqual(
        getAutocastCompatibilityMessage(result.reason),
        "You can't autocast that spell with this weapon.",
    );
})();

(function testMagicStaffCanAutocastStandardCombatSpells() {
    const result = canWeaponAutocastSpell(1381, 3273);
    assert.strictEqual(result.compatible, true);
    assert.strictEqual(result.reason, undefined);
})();

(function testPoweredStaffKeepsDedicatedAutocastFailureReason() {
    const result = canWeaponAutocastSpell(27275, 3273);
    assert.strictEqual(result.compatible, false);
    assert.strictEqual(result.reason, "powered_staff");
})();

console.log("Autocast compatibility test passed.");
