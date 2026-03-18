import assert from "assert";

import { SkillId } from "../../src/rs/skill/skills";
import { getLocEffect } from "../src/data/locEffects";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { prayerAltarModule } from "../src/game/scripts/modules/skills/prayerAltars";
import { type ScriptServices } from "../src/game/scripts/types";
import { createTestScriptServices } from "./scriptServices";

type InventoryEntry = { slot: number; itemId: number; quantity: number };

type Harness = {
    registry: ScriptRegistry;
    services: ScriptServices;
    player: PlayerState;
    inventory: InventoryEntry[];
    calls: {
        messages: string[];
        seqs: number[];
        xp: number;
        consumedSlots: number[];
        snapshots: number;
        locGraphics: Array<{ spotId: number; tile: { x: number; y: number }; level?: number }>;
        locSounds: Array<{ soundId: number; tile?: { x: number; y: number }; level?: number }>;
    };
};

const ITEM_NAMES = new Map<number, string>([
    [526, "Bones"],
    [530, "Bat bones"],
    [536, "Dragon bones"],
]);

const ALTAR_EFFECT = getLocEffect(13179);
if (!ALTAR_EFFECT) {
    throw new Error("Expected altar loc effect definition for loc 13179");
}
const ALTAR_EXPECTED_SPOT = ALTAR_EFFECT.graphic?.spotId ?? -1;
const ALTAR_EXPECTED_SOUND = ALTAR_EFFECT.sound?.soundId ?? -1;

function createHarness(initialInventory: InventoryEntry[] = []): Harness {
    const registry = new ScriptRegistry();
    const player = new PlayerState(1, 3200, 3200, 0);
    const inventory = initialInventory.map((entry) => ({ ...entry }));
    const calls = {
        messages: [] as string[],
        seqs: [] as number[],
        xp: 0,
        consumedSlots: [] as number[],
        snapshots: 0,
        locGraphics: [] as Array<{
            spotId: number;
            tile: { x: number; y: number };
            level?: number;
        }>,
        locSounds: [] as Array<{
            soundId: number;
            tile?: { x: number; y: number };
            level?: number;
        }>,
    };
    const services: ScriptServices = createTestScriptServices();
    services.consumeItem = (_player, slotIndex) => {
        const entry = inventory.find((e) => e.slot === slotIndex);
        if (!entry || entry.itemId <= 0 || entry.quantity <= 0) return false;
        entry.quantity -= 1;
        calls.consumedSlots.push(slotIndex);
        if (entry.quantity <= 0) {
            entry.itemId = -1;
            entry.quantity = 0;
        }
        return true;
    };
    services.getInventoryItems = () => inventory.map((entry) => ({ ...entry }));
    services.addSkillXp = (p, skillId, xp) => {
        if (skillId === SkillId.Prayer) {
            calls.xp += xp;
        }
        const prev = p.getSkill(skillId)?.xp ?? 0;
        p.setSkillXp(skillId, prev + xp);
    };
    services.getObjType = (itemId) => ({
        name: ITEM_NAMES.get(itemId) ?? "Bones",
        noted: false,
    });
    services.sendGameMessage = (_player, text) => {
        calls.messages.push(text);
    };
    services.playPlayerSeq = (_player, seq) => {
        calls.seqs.push(seq);
    };
    services.snapshotInventoryImmediate = () => {
        calls.snapshots++;
    };
    services.playLocGraphic = (opts) => {
        if (opts) {
            calls.locGraphics.push({
                spotId: opts.spotId,
                tile: { x: opts.tile.x, y: opts.tile.y },
                level: opts.level,
            });
        }
    };
    services.playLocSound = (opts) => {
        if (opts) {
            calls.locSounds.push({
                soundId: opts.soundId,
                tile: opts.tile ? { x: opts.tile.x, y: opts.tile.y } : undefined,
                level: opts.level,
            });
        }
    };
    prayerAltarModule.register(registry, services);
    return { registry, services, player, inventory, calls };
}

function invokeLocAction(harness: Harness, locId: number, action: string, tick: number): void {
    const handler = harness.registry.findLocInteraction(locId, action);
    assert.ok(handler, `expected handler for loc=${locId} action=${action}`);
    handler({
        tick,
        services: harness.services,
        player: harness.player,
        locId,
        tile: { x: 0, y: 0 },
        level: 0,
        action,
    } as any);
}

function testPrayAtAltarRestoresPrayer(): void {
    const harness = createHarness();
    const { player, calls } = harness;
    player.adjustSkillBoost(SkillId.Prayer, -5);
    invokeLocAction(harness, 409, "pray-at", 10);
    assert.strictEqual(
        player.getPrayerLevel(),
        player.getSkill(SkillId.Prayer).baseLevel,
        "Praying at an altar should refill to the base level.",
    );
    assert.deepStrictEqual(calls.messages, ["You recharge your Prayer points."]);
    assert.deepStrictEqual(calls.seqs, [645], "Pray animation should fire once");
}

function testPrayCooldownBlocksSpam(): void {
    const harness = createHarness();
    const { player, calls } = harness;
    player.adjustSkillBoost(SkillId.Prayer, -3);
    invokeLocAction(harness, 409, "pray-at", 5);
    const messagesAfterFirst = calls.messages.length;
    invokeLocAction(harness, 409, "pray-at", 6); // still on cooldown
    assert.strictEqual(
        calls.messages.length,
        messagesAfterFirst,
        "Cooldown should prevent immediate follow-up message.",
    );
}

function testOfferSingleBoneConsumesOne(): void {
    const harness = createHarness([
        { slot: 0, itemId: 536, quantity: 1 },
        { slot: 1, itemId: 526, quantity: 1 },
    ]);
    invokeLocAction(harness, 13179, "offer", 20);
    assert.strictEqual(harness.calls.xp, Math.round(72 * 3.5));
    assert.deepStrictEqual(harness.calls.consumedSlots, [0]);
    assert.deepStrictEqual(harness.calls.seqs, [713]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You offer the dragon bones at the altar.",
        "The gods are pleased with your offering.",
    ]);
    assert.strictEqual(harness.inventory[0]?.itemId, -1, "Slot 0 should now be empty");
    assert.strictEqual(harness.inventory[1]?.itemId, 526, "Other items remain untouched");
    assert.deepStrictEqual(harness.calls.locGraphics, [
        { spotId: ALTAR_EXPECTED_SPOT, tile: { x: 0, y: 0 }, level: 0 },
    ]);
    assert.deepStrictEqual(harness.calls.locSounds, [
        { soundId: ALTAR_EXPECTED_SOUND, tile: { x: 0, y: 0 }, level: 0 },
    ]);
}

function testOfferAllConsumesMultipleBones(): void {
    const harness = createHarness([
        { slot: 0, itemId: 536, quantity: 2 },
        { slot: 1, itemId: 526, quantity: 1 },
    ]);
    invokeLocAction(harness, 13199, "offer-all", 30);
    const expectedXp = Math.round(72 * 3.5) * 2 + Math.round(5 * 3.5);
    assert.strictEqual(harness.calls.xp, expectedXp, "Offer-all should sum XP across bones.");
    assert.deepStrictEqual(harness.calls.consumedSlots, [0, 0, 1]);
    assert.strictEqual(harness.calls.snapshots, 1, "Inventory snapshot should fire once");
    assert.deepStrictEqual(harness.calls.messages, [
        "You offer 2 dragon bones at the altar.",
        "You offer the bones at the altar.",
        "The gods are pleased with your offering.",
    ]);
    assert.strictEqual(harness.calls.locGraphics.length, 1);
    assert.strictEqual(harness.calls.locSounds.length, 1);
}

function testOfferWithNoBonesWarnsPlayer(): void {
    const harness = createHarness();
    invokeLocAction(harness, 13179, "offer", 40);
    assert.deepStrictEqual(harness.calls.messages, ["You have no bones to offer."]);
    assert.strictEqual(harness.calls.xp, 0);
    assert.strictEqual(harness.calls.locGraphics.length, 0);
    assert.strictEqual(harness.calls.locSounds.length, 0);
}

testPrayAtAltarRestoresPrayer();
testPrayCooldownBlocksSpam();
testOfferSingleBoneConsumesOne();
testOfferAllConsumesMultipleBones();
testOfferWithNoBonesWarnsPlayer();

console.log("Prayer altar module tests passed.");
