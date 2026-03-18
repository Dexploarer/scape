import assert from "assert";

import { buildAnimSetFromBas, ensureCorePlayerAnimSet } from "../src/network/anim/playerAnim";

function testEnsureCoreFillsMissing(): void {
    const fallback = { idle: 808, walk: 819, run: 824, turnLeft: 823, turnRight: 823 };

    const fromMissing = ensureCorePlayerAnimSet(undefined, fallback);
    assert.strictEqual(fromMissing.idle, 808);
    assert.strictEqual(fromMissing.walk, 819);
    assert.strictEqual(fromMissing.run, 824);
    assert.strictEqual(fromMissing.turnLeft, 823);
    assert.strictEqual(fromMissing.turnRight, 823);

    const partial = ensureCorePlayerAnimSet({ idle: 1234 }, fallback);
    assert.strictEqual(partial.idle, 1234);
    assert.strictEqual(partial.walk, 819);
    assert.strictEqual(partial.run, 824);
    assert.strictEqual(partial.turnLeft, 823);
    assert.strictEqual(partial.turnRight, 823);
}

function testBuildAnimSetFromBas(): void {
    const bas = {
        idleSeqId: 808,
        walkSeqId: 819,
        runSeqId: 824,
        idleLeftSeqId: 823,
        idleRightSeqId: -1,
    };
    const anim = buildAnimSetFromBas(bas);
    assert(anim);
    assert.strictEqual(anim!.idle, 808);
    assert.strictEqual(anim!.walk, 819);
    assert.strictEqual(anim!.run, 824);
    // turnRight falls back to idleLeft when idleRight is missing.
    assert.strictEqual(anim!.turnLeft, 823);
    assert.strictEqual(anim!.turnRight, 823);
}

testEnsureCoreFillsMissing();
testBuildAnimSetFromBas();
