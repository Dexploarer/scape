import assert from "assert";

import {
    getLocEffect,
    populateLocEffectsFromLoader,
    registerLocEffect,
    registerLocEffects,
    unregisterLocEffect,
} from "../src/data/locEffects";

const CUSTOM_LOC_ID = 99999;

function testRegisterLocEffect(): void {
    const dispose = registerLocEffect(CUSTOM_LOC_ID, {
        graphic: { spotId: 12345, height: 64 },
    });
    const effect = getLocEffect(CUSTOM_LOC_ID);
    assert.ok(effect, "effect should be registered");
    assert.strictEqual(effect?.graphic?.spotId, 12345);
    dispose();
    assert.strictEqual(getLocEffect(CUSTOM_LOC_ID), undefined);
}

function testRegisterLocEffectsBatch(): void {
    const entries = [
        { locId: CUSTOM_LOC_ID + 1, effect: { sound: { soundId: 777 } } },
        { locId: CUSTOM_LOC_ID + 2, effect: { graphic: { spotId: 888 } } },
    ];
    const dispose = registerLocEffects(entries);
    assert.strictEqual(getLocEffect(CUSTOM_LOC_ID + 1)?.sound?.soundId, 777);
    assert.strictEqual(getLocEffect(CUSTOM_LOC_ID + 2)?.graphic?.spotId, 888);
    dispose();
    assert.strictEqual(getLocEffect(CUSTOM_LOC_ID + 1), undefined);
    assert.strictEqual(getLocEffect(CUSTOM_LOC_ID + 2), undefined);
}

function testPopulateFromLoader(): void {
    const locA = CUSTOM_LOC_ID + 3;
    const locB = CUSTOM_LOC_ID + 4;
    unregisterLocEffect(locA);
    unregisterLocEffect(locB);
    const loader: any = {
        getCount: () => 3,
        load: (idx: number) => {
            if (idx === 0)
                return {
                    id: locA,
                    ambientSoundId: 900,
                    ambientSoundIds: [],
                };
            if (idx === 1)
                return {
                    id: locB,
                    ambientSoundId: -1,
                    ambientSoundIds: [901, 902],
                };
            return undefined;
        },
    };
    const registered = populateLocEffectsFromLoader(loader);
    assert.strictEqual(registered, 2);
    assert.strictEqual(getLocEffect(locA)?.sound?.soundId, 900);
    assert.strictEqual(getLocEffect(locB)?.sound?.soundId, 901);
    // Existing manual entry shouldn't be overridden unless replaceExisting is true
    registerLocEffect(locB, { sound: { soundId: 777 } }, { replaceExisting: true });
    populateLocEffectsFromLoader(loader, { replaceExisting: false });
    assert.strictEqual(getLocEffect(locB)?.sound?.soundId, 777);
    populateLocEffectsFromLoader(loader, { replaceExisting: true });
    assert.strictEqual(getLocEffect(locB)?.sound?.soundId, 901);
    unregisterLocEffect(locA);
    unregisterLocEffect(locB);
}

testRegisterLocEffect();
testRegisterLocEffectsBatch();

console.log("Loc effect registry tests passed.");
