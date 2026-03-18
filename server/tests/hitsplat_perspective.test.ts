import assert from "assert";

import { CombatEffectApplicator } from "../src/game/combat/CombatEffectApplicator";
import type { NpcState } from "../src/game/npc";
import {
    HITSPLAT_STYLE_BLOCK,
    HITSPLAT_STYLE_DAMAGE,
    OSRS_HITSPLAT_BLOCK_ME,
    OSRS_HITSPLAT_BLOCK_OTHER,
    OSRS_HITSPLAT_DAMAGE_ME,
    OSRS_HITSPLAT_DAMAGE_OTHER,
    OSRS_HITSPLAT_POISON,
    OSRS_HITSPLAT_POISON_MAX,
    OSRS_HITSPLAT_POISON_ME,
    OSRS_HITSPLAT_POISON_OTHER,
    resolveHitsplatTypeForObserver,
} from "../src/game/combat/OsrsHitsplatIds";

function createNpcStub(hp: number = 20): NpcState {
    let current = hp;
    return {
        getHitpoints: () => current,
        getMaxHitpoints: () => hp,
        isPlayerFollower: () => false,
        inflictPoison: () => {},
        applyDamage: (amount: number) => {
            current = Math.max(0, current - Math.max(0, amount | 0));
            return { current, max: hp };
        },
    } as unknown as NpcState;
}

function testOutgoingNpcDamageUsesYouVariant() {
    const style = resolveHitsplatTypeForObserver(
        HITSPLAT_STYLE_DAMAGE,
        100,
        "npc",
        200,
        100,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_DAMAGE_ME);
}

function testIncomingPlayerDamageUsesYouVariant() {
    const style = resolveHitsplatTypeForObserver(
        HITSPLAT_STYLE_DAMAGE,
        100,
        "player",
        100,
        200,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_DAMAGE_ME);
}

function testIncomingNpcBlockUsesYouVariant() {
    const style = resolveHitsplatTypeForObserver(
        HITSPLAT_STYLE_BLOCK,
        100,
        "player",
        100,
        undefined,
        "npc",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_BLOCK_ME);
}

function testFollowerDamageUsesOtherVariant() {
    const style = resolveHitsplatTypeForObserver(
        HITSPLAT_STYLE_DAMAGE,
        100,
        "npc",
        200,
        100,
        "follower",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_DAMAGE_OTHER);
}

function testOutgoingPoisonUsesYouVariant() {
    const style = resolveHitsplatTypeForObserver(
        OSRS_HITSPLAT_POISON,
        100,
        "npc",
        200,
        100,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_POISON_ME);
}

function testIncomingPoisonUsesYouVariant() {
    const style = resolveHitsplatTypeForObserver(
        OSRS_HITSPLAT_POISON,
        100,
        "player",
        100,
        undefined,
        "status",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_POISON_ME);
}

function testUninvolvedObserverSeesOtherPoisonVariant() {
    const style = resolveHitsplatTypeForObserver(
        OSRS_HITSPLAT_POISON,
        300,
        "player",
        100,
        200,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_POISON_OTHER);
}

function testPoisonCritUsesGlobalVariant() {
    const applicator = new CombatEffectApplicator();
    const npc = createNpcStub();
    const result = applicator.applyNpcHitsplat(npc, OSRS_HITSPLAT_POISON, 4, 0, 4);
    assert.strictEqual(result.style, OSRS_HITSPLAT_POISON_MAX);
}

function testPoisonCritStaysGlobalForObservers() {
    const style = resolveHitsplatTypeForObserver(
        OSRS_HITSPLAT_POISON_MAX,
        300,
        "player",
        100,
        200,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_POISON_MAX);
}

function testUninvolvedObserverSeesOtherVariant() {
    const style = resolveHitsplatTypeForObserver(
        HITSPLAT_STYLE_DAMAGE,
        300,
        "player",
        100,
        200,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_DAMAGE_OTHER);
}

function testUninvolvedObserverSeesOtherBlockVariant() {
    const style = resolveHitsplatTypeForObserver(
        HITSPLAT_STYLE_BLOCK,
        300,
        "npc",
        200,
        100,
        "player",
    );
    assert.strictEqual(style, OSRS_HITSPLAT_BLOCK_OTHER);
}

function main() {
    testOutgoingNpcDamageUsesYouVariant();
    testIncomingPlayerDamageUsesYouVariant();
    testIncomingNpcBlockUsesYouVariant();
    testFollowerDamageUsesOtherVariant();
    testOutgoingPoisonUsesYouVariant();
    testIncomingPoisonUsesYouVariant();
    testUninvolvedObserverSeesOtherPoisonVariant();
    testPoisonCritUsesGlobalVariant();
    testPoisonCritStaysGlobalForObservers();
    testUninvolvedObserverSeesOtherVariant();
    testUninvolvedObserverSeesOtherBlockVariant();
    console.log("Hitsplat perspective tests passed.");
}

main();
