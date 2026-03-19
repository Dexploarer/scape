import assert from "assert";

import { EquipmentSlot } from "../../src/rs/config/player/Equipment";
import {
    DEFAULT_EQUIP_SLOT_COUNT,
    consumeEquippedAmmoApply,
    ensureEquipArrayOn,
    ensureEquipQtyArrayOn,
    equipItemApply,
    inferEquipSlot,
    unequipItemApply,
} from "../src/game/equipment";

function mockGetObj(name: string) {
    return () => ({ name });
}

function makeEmptyInv(n = 28) {
    return Array.from({ length: n }, () => ({ itemId: -1, quantity: 0 }));
}

function testEnsureEquipArrayOn() {
    const ap: any = { gender: 0, equip: [1, 2, 3] };
    const arr = ensureEquipArrayOn(ap, 14);
    assert.strictEqual(arr.length, 14);
    assert.strictEqual(ap.equip.length, 14);
    assert.strictEqual(arr[0], 1);
    assert.strictEqual(arr[1], 2);
    assert.strictEqual(arr[2], 3);
    assert.strictEqual(arr[13], -1);
}

function testInferEquipSlotCapeHeuristic() {
    const slot = inferEquipSlot(9999, mockGetObj("Hitpoints cape"), {} as any);
    assert.strictEqual(slot, EquipmentSlot.CAPE, "should infer CAPE from name");
}

function testEquipItemApplyTwoHandedAndSwap() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();
    // Inventory slot 0 holds weapon 11802 (two-handed)
    inv[0] = { itemId: 11802, quantity: 1 };
    // Equip a shield and a previous weapon
    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    appearance.equip[EquipmentSlot.SHIELD] = 11284; // Dragonfire shield
    appearance.equip[EquipmentSlot.WEAPON] = 4587; // Dragon scimitar (previous)

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 11802,
        equipSlot: EquipmentSlot.WEAPON,
        getObjType: (id) => ({ id }),
        addItemToInventory: (id, qty) => {
            const idx = inv.findIndex((s) => s.itemId <= 0 || s.quantity <= 0);
            if (idx >= 0) {
                inv[idx].itemId = id;
                inv[idx].quantity = qty;
                return { slot: idx, added: qty };
            }
            return { slot: -1, added: 0 };
        },
    });
    assert.ok(res.ok, "equip should succeed");
    // Two-handed clears shield
    assert.strictEqual(appearance.equip[EquipmentSlot.SHIELD], -1);
    // Previous weapon moved back to inventory slot 0
    assert.strictEqual(inv[0].itemId, 4587);
    assert.strictEqual(inv[0].quantity, 1);
    // New weapon equipped
    assert.strictEqual(appearance.equip[EquipmentSlot.WEAPON], 11802);
}

function testEquipItemApplyTwoHandedRequiresExtraSlotWhenShieldAndWeaponOccupied() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    // Fill inventory completely (no empty slots).
    for (let i = 0; i < inv.length; i++) inv[i] = { itemId: 995, quantity: 1 };
    // Slot 0 holds the two-handed weapon we are trying to equip.
    inv[0] = { itemId: 11802, quantity: 1 };

    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    appearance.equip[EquipmentSlot.SHIELD] = 11284; // Shield equipped
    appearance.equip[EquipmentSlot.WEAPON] = 4587; // Weapon slot already occupied

    const snapshotInv = inv.map((e) => ({ itemId: e.itemId, quantity: e.quantity }));
    const snapshotEquip = appearance.equip.slice();

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 11802,
        equipSlot: EquipmentSlot.WEAPON,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(!res.ok, "equip should fail without extra inventory space");
    assert.strictEqual(res.reason, "inventory_full_for_shield");
    assert.deepStrictEqual(inv, snapshotInv, "inventory should not change on failure");
    assert.deepStrictEqual(
        appearance.equip,
        snapshotEquip,
        "equipment should not change on failure",
    );
}

function testEquipItemApplyTwoHandedMovesShieldToFreeSlotWhenWeaponOccupied() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    // Fill inventory except for slot 5 (free slot for shield).
    for (let i = 0; i < inv.length; i++) inv[i] = { itemId: 995, quantity: 1 };
    inv[5] = { itemId: -1, quantity: 0 };
    inv[0] = { itemId: 11802, quantity: 1 }; // new 2h weapon to equip

    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    appearance.equip[EquipmentSlot.SHIELD] = 11284;
    appearance.equip[EquipmentSlot.WEAPON] = 4587;

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 11802,
        equipSlot: EquipmentSlot.WEAPON,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(res.ok, "equip should succeed when a free slot exists");
    assert.strictEqual(appearance.equip[EquipmentSlot.WEAPON], 11802);
    assert.strictEqual(appearance.equip[EquipmentSlot.SHIELD], -1);
    assert.strictEqual(inv[0].itemId, 4587, "previous weapon swaps into clicked slot");
    assert.strictEqual(inv[5].itemId, 11284, "shield moved into free slot");
}

function testEquipItemApplyShieldUnequipsTwoHandedWeapon() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();
    // Slot 0 holds a shield we are equipping.
    inv[0] = { itemId: 11284, quantity: 1 };
    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    // Currently wearing a two-handed weapon.
    appearance.equip[EquipmentSlot.WEAPON] = 11802;

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 11284,
        equipSlot: EquipmentSlot.SHIELD,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(res.ok);
    assert.strictEqual(appearance.equip[EquipmentSlot.SHIELD], 11284);
    assert.strictEqual(
        appearance.equip[EquipmentSlot.WEAPON],
        -1,
        "2h weapon should be unequipped",
    );
    assert.strictEqual(inv[0].itemId, 11802, "2h weapon moved into clicked slot");
}

function testEquipItemApplyShieldNeedsExtraSlotWhenTwoHandedWeaponAndShieldOccupied() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    // Fill inventory completely (no empty slots).
    for (let i = 0; i < inv.length; i++) inv[i] = { itemId: 995, quantity: 1 };
    // Slot 0 holds the new shield we are trying to equip.
    inv[0] = { itemId: 11284, quantity: 1 };

    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    // Weapon is two-handed, and shield slot already has something equipped.
    appearance.equip[EquipmentSlot.WEAPON] = 11802;
    appearance.equip[EquipmentSlot.SHIELD] = 1540; // Anti-dragon shield (arbitrary)

    const snapshotInv = inv.map((e) => ({ itemId: e.itemId, quantity: e.quantity }));
    const snapshotEquip = appearance.equip.slice();

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 11284,
        equipSlot: EquipmentSlot.SHIELD,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(!res.ok);
    assert.strictEqual(res.reason, "inventory_full_for_weapon");
    assert.deepStrictEqual(inv, snapshotInv, "inventory should not change on failure");
    assert.deepStrictEqual(
        appearance.equip,
        snapshotEquip,
        "equipment should not change on failure",
    );
}

function testEquipItemApplyShieldMovesTwoHandedWeaponToFreeSlotWhenShieldOccupied() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    // Fill inventory except slot 7 is free for the weapon to land.
    for (let i = 0; i < inv.length; i++) inv[i] = { itemId: 995, quantity: 1 };
    inv[7] = { itemId: -1, quantity: 0 };
    // Slot 0 holds the new shield to equip.
    inv[0] = { itemId: 11284, quantity: 1 };

    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    appearance.equip[EquipmentSlot.WEAPON] = 11802;
    appearance.equip[EquipmentSlot.SHIELD] = 1540;

    // If ammo quantity exists in the array, keep it aligned.
    appearance.equipQty[EquipmentSlot.WEAPON] = 1;
    appearance.equipQty[EquipmentSlot.SHIELD] = 1;

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 11284,
        equipSlot: EquipmentSlot.SHIELD,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(res.ok);
    assert.strictEqual(appearance.equip[EquipmentSlot.SHIELD], 11284);
    assert.strictEqual(appearance.equip[EquipmentSlot.WEAPON], -1);
    assert.strictEqual(inv[0].itemId, 1540, "previous shield swaps into clicked slot");
    assert.strictEqual(inv[7].itemId, 11802, "2h weapon moved into free slot");
}

function testEquipItemApplyUsesCacheWearPosConflictsForShadowLikeWeapons() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    inv[0] = { itemId: 27275, quantity: 1 }; // Tumeken's shadow
    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    appearance.equip[EquipmentSlot.SHIELD] = 11284;
    appearance.equipQty[EquipmentSlot.SHIELD] = 1;

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 27275,
        equipSlot: EquipmentSlot.WEAPON,
        getObjType: (id) => {
            if (id === 27275) {
                return { id, op13: 3, op14: 5, op27: -1 } as any;
            }
            return { id } as any;
        },
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });

    assert.ok(res.ok, "equip should respect cache wearPos2 conflicts");
    assert.strictEqual(appearance.equip[EquipmentSlot.WEAPON], 27275);
    assert.strictEqual(appearance.equip[EquipmentSlot.SHIELD], -1);
    assert.strictEqual(inv[0].itemId, 11284, "shield moved into clicked slot");
}

function testUnequipItemApply() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();
    appearance.equip[EquipmentSlot.CAPE] = 9768; // Hitpoints cape
    appearance.equipQty[EquipmentSlot.CAPE] = 1;

    const res = unequipItemApply({
        appearance,
        equipSlot: EquipmentSlot.CAPE,
        addItemToInventory: (id, qty) => {
            const idx = inv.findIndex((s) => s.itemId <= 0 || s.quantity <= 0);
            if (idx >= 0) {
                inv[idx].itemId = id;
                inv[idx].quantity = qty;
                return { slot: idx, added: qty };
            }
            return { slot: -1, added: 0 };
        },
        slotCount: DEFAULT_EQUIP_SLOT_COUNT,
    });
    assert.ok(res.ok, "unequip should succeed");
    assert.strictEqual(appearance.equip[EquipmentSlot.CAPE], -1);
    assert.ok(
        inv.some((s) => s.itemId === 9768 && s.quantity === 1),
        "cape moved to inv",
    );
}

function testEquipItemApplyAmmoEquipsStackAndSwapsStack() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);

    // Equip a stack of ammo from inventory.
    inv[0] = { itemId: 882, quantity: 123 }; // Bronze arrow (arbitrary ammo id)
    let res = equipItemApply({
        appearance,
        inv,
        slotIndex: 0,
        itemId: 882,
        equipSlot: EquipmentSlot.AMMO,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(res.ok);
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], 882);
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 123);
    assert.strictEqual(inv[0].itemId, -1);
    assert.strictEqual(inv[0].quantity, 0);

    // Swap with a different ammo stack from inventory slot 5.
    inv[5] = { itemId: 884, quantity: 50 }; // Iron arrow (arbitrary)
    res = equipItemApply({
        appearance,
        inv,
        slotIndex: 5,
        itemId: 884,
        equipSlot: EquipmentSlot.AMMO,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });
    assert.ok(res.ok);
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], 884);
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 50);
    assert.strictEqual(inv[5].itemId, 882, "previous ammo item swapped into clicked slot");
    assert.strictEqual(inv[5].quantity, 123, "previous ammo quantity swapped into clicked slot");
}

function testEquipItemApplyAmmoMergesMatchingEquippedStack() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();

    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);

    appearance.equip[EquipmentSlot.AMMO] = 882;
    appearance.equipQty[EquipmentSlot.AMMO] = 500;
    inv[3] = { itemId: 882, quantity: 1 };

    const res = equipItemApply({
        appearance,
        inv,
        slotIndex: 3,
        itemId: 882,
        equipSlot: EquipmentSlot.AMMO,
        getObjType: (id) => ({ id }),
        addItemToInventory: () => ({ slot: -1, added: 0 }),
    });

    assert.ok(res.ok);
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], 882);
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 501);
    assert.strictEqual(inv[3].itemId, -1, "matching ammo should merge instead of swapping");
    assert.strictEqual(inv[3].quantity, 0, "source inventory stack should be consumed");
}

function testUnequipItemApplyAmmoMovesWholeStack() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    const inv = makeEmptyInv();
    appearance.equip[EquipmentSlot.AMMO] = 882;
    appearance.equipQty[EquipmentSlot.AMMO] = 250;

    const res = unequipItemApply({
        appearance,
        equipSlot: EquipmentSlot.AMMO,
        addItemToInventory: (id, qty) => {
            const idx = inv.findIndex((s) => s.itemId <= 0 || s.quantity <= 0);
            if (idx >= 0) {
                inv[idx].itemId = id;
                inv[idx].quantity = qty;
                return { slot: idx, added: qty };
            }
            return { slot: -1, added: 0 };
        },
        slotCount: DEFAULT_EQUIP_SLOT_COUNT,
    });
    assert.ok(res.ok);
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], -1);
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 0);
    assert.ok(
        inv.some((s) => s.itemId === 882 && s.quantity === 250),
        "ammo stack moved to inv",
    );
}

function testConsumeEquippedAmmoApplyDecrementsAndClears() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);

    appearance.equip[EquipmentSlot.AMMO] = 882;
    appearance.equipQty[EquipmentSlot.AMMO] = 3;

    let res = consumeEquippedAmmoApply({ appearance, count: 1 });
    assert.ok(res.ok);
    assert.strictEqual(res.itemId, 882);
    assert.strictEqual(res.remaining, 2);
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], 882);
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 2);

    res = consumeEquippedAmmoApply({ appearance, count: 2 });
    assert.ok(res.ok);
    assert.strictEqual(res.remaining, 0);
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], -1, "ammo slot cleared when empty");
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 0);
}

function testConsumeEquippedAmmoApplyFailsWhenInsufficient() {
    const appearance: any = {
        gender: 0,
        equip: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(-1),
        equipQty: new Array<number>(DEFAULT_EQUIP_SLOT_COUNT).fill(0),
    };
    ensureEquipArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);
    ensureEquipQtyArrayOn(appearance, DEFAULT_EQUIP_SLOT_COUNT);

    appearance.equip[EquipmentSlot.AMMO] = 882;
    appearance.equipQty[EquipmentSlot.AMMO] = 1;

    const res = consumeEquippedAmmoApply({ appearance, count: 2 });
    assert.ok(!res.ok);
    assert.strictEqual(res.reason, "ammo_insufficient");
    assert.strictEqual(appearance.equip[EquipmentSlot.AMMO], 882);
    assert.strictEqual(appearance.equipQty[EquipmentSlot.AMMO], 1);
}

function main() {
    testEnsureEquipArrayOn();
    testInferEquipSlotCapeHeuristic();
    testEquipItemApplyTwoHandedAndSwap();
    testEquipItemApplyTwoHandedRequiresExtraSlotWhenShieldAndWeaponOccupied();
    testEquipItemApplyTwoHandedMovesShieldToFreeSlotWhenWeaponOccupied();
    testEquipItemApplyShieldUnequipsTwoHandedWeapon();
    testEquipItemApplyShieldNeedsExtraSlotWhenTwoHandedWeaponAndShieldOccupied();
    testEquipItemApplyShieldMovesTwoHandedWeaponToFreeSlotWhenShieldOccupied();
    testEquipItemApplyUsesCacheWearPosConflictsForShadowLikeWeapons();
    testUnequipItemApply();
    testEquipItemApplyAmmoEquipsStackAndSwapsStack();
    testEquipItemApplyAmmoMergesMatchingEquippedStack();
    testUnequipItemApplyAmmoMovesWholeStack();
    testConsumeEquippedAmmoApplyDecrementsAndClears();
    testConsumeEquippedAmmoApplyFailsWhenInsufficient();
    // eslint-disable-next-line no-console
    console.log("Equipment tests passed.");
}

main();
