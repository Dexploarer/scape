import assert from "assert";

import { SpellActionHandler } from "../src/game/actions/handlers/SpellActionHandler";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

function createPlayer(): PlayerState {
    return new PlayerState(3, 3235, 3223, 0);
}

function createNpc(): NpcState {
    return new NpcState(
        19998,
        0,
        1,
        -1,
        -1,
        32,
        { x: 3235, y: 3219, level: 0 },
        { maxHitpoints: 10 },
    );
}

function testManualSpellUsesDeliveryTickForHitScheduling(): void {
    const player = createPlayer();
    const npc = createNpc();
    const scheduled: Array<{ tick: number; request: any }> = [];
    const launches: any[] = [];
    const combatStarts: Array<{ tick: number; attackSpeed: number }> = [];
    const stoppedAutoAttack: number[] = [];

    const handler = new SpellActionHandler({
        getCurrentTick: () => 6,
        getDeliveryTick: () => 7,
        getTickMs: () => 600,
        getFramesPerTick: () => 30,
        getNpc: (id) => (id === npc.id ? npc : undefined),
        getPlayer: () => undefined,
        getPlayerSocket: () => ({}) as any,
        getNpcType: () => ({ name: "Cow calf" }),
        getSpellData: (spellId) =>
            spellId === 3273
                ? ({
                      id: 3273,
                      name: "Wind Strike",
                      baseMaxHit: 2,
                      projectileId: 91,
                      castSpotAnim: 90,
                      impactSpotAnim: 92,
                      splashSpotAnim: 85,
                  } as any)
                : undefined,
        getSpellDataByWidget: () => undefined,
        getProjectileParams: () =>
            ({
                startHeight: 43,
                endHeight: 31,
                slope: 16,
                steepness: 64,
            }) as any,
        canWeaponAutocastSpell: () => ({ compatible: true }),
        getSpellBaseXp: () => 0,
        validateSpellCast: () => ({ success: true }) as any,
        executeSpellCast: () => ({ experienceGained: 0, runesConsumed: [] }) as any,
        computeProjectileEndHeight: () => 31,
        estimateProjectileTiming: () =>
            ({
                startDelay: 51 / 30,
                travelTime: 1.167,
                hitDelay: 2.867,
            }) as any,
        buildAndQueueSpellProjectileLaunch: (opts) => launches.push(opts),
        queueSpellResult: () => {},
        enqueueSpotAnimation: () => {},
        enqueueSpellFailureChat: () => {},
        pickSpellSound: () => undefined,
        broadcastSound: () => {},
        withDirectSendBypass: (_tag, fn) => fn(),
        resetAutocast: () => {},
        queueCombatSnapshot: () => {},
        pickAttackSequence: () => 711,
        pickSpellCastSequence: () => 711,
        pickAttackSpeed: () => 5,
        clearAllInteractions: () => {},
        clearActionsInGroup: () => 0,
        startNpcCombat: (_player, targetNpc, tick, attackSpeed) => {
            assert.strictEqual(targetNpc, npc);
            combatStarts.push({ tick, attackSpeed });
        },
        stopAutoAttack: (playerId) => {
            stoppedAutoAttack.push(playerId);
        },
        sendInventorySnapshot: () => {},
        scheduleAction: (_playerId, request, tick) => {
            scheduled.push({ tick, request });
            return { ok: true };
        },
        awardSkillXp: () => {},
        planPlayerVsPlayerMagic: () => ({ hitLanded: true, maxHit: 2, damage: 2 }),
        planPlayerVsNpcMagic: () => ({ hitLanded: true, maxHit: 2, damage: 2 }),
        faceAngleRs: () => 0,
        testRandFloat: () => 0,
        getTestHitForce: () => undefined,
        log: () => {},
    } as any);

    const result = handler.processSpellCastRequest(
        player,
        {
            spellId: 3273,
            target: { type: "npc", npcId: npc.id },
            modifiers: { castMode: "manual" },
        },
        6,
    );

    assert.strictEqual(result.outcome, "success");
    assert.strictEqual(scheduled.length, 1);
    assert.strictEqual(scheduled[0]!.tick, 7, "scheduled hit should be based on delivery tick");
    assert.strictEqual(scheduled[0]!.request.delayTicks, 3);
    assert.deepStrictEqual(
        combatStarts,
        [{ tick: 6, attackSpeed: 5 }],
        "manual npc spell casts should enter combat so NPC retaliation can resolve",
    );
    assert.deepStrictEqual(
        stoppedAutoAttack,
        [player.id],
        "manual npc spell casts should remain one-shot and not auto-repeat",
    );
    assert.strictEqual(
        player.canLogout(),
        true,
        "manual NPC spell casts should not block logout before the NPC hits back",
    );
    assert.strictEqual(
        scheduled[0]!.request.data.expectedHitTick,
        10,
        "expected hit tick should be delivery tick plus impact delay",
    );
    assert.strictEqual(launches.length, 1);
    assert.strictEqual(launches[0]!.impactDelayTicks, 3);
}

testManualSpellUsesDeliveryTickForHitScheduling();

console.log("Spell delivery tick alignment test passed.");
