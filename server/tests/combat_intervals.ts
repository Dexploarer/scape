import assert from "assert";

import { HITMARK_DAMAGE } from "../src/game/combat/HitEffects";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import { WSServer } from "../src/network/wsServer";

type RecordedRequest = {
    playerId: number;
    req: {
        kind: string;
        data: any;
        delayTicks: number;
        groups: string[];
    };
    currentTick: number;
};

type CombatHarness = {
    server: any;
    player: PlayerState;
    npc: NpcState;
    actionRequests: RecordedRequest[];
    broadcasts: Array<{ type: string; payload: any }>;
    baseTick: number;
};

function createCombatHarness(baseTick: number = 100): CombatHarness {
    const npcTileX = 3222;
    const npcTileY = 3222;
    const player = new PlayerState(1, npcTileX, npcTileY - 1, 0);
    const npc = new NpcState(
        42,
        0,
        1,
        -1,
        -1,
        32,
        { x: npcTileX, y: npcTileY, level: 0 },
        { maxHitpoints: 25 },
    );

    const actionRequests: RecordedRequest[] = [];
    const broadcasts: Array<{ type: string; payload: any }> = [];
    let npcAlive = true;

    const respawnQueue: Array<{ npcId: number; respawnTick: number }> = [];

    const server: any = Object.create(WSServer.prototype);
    server.options = {
        ticker: {
            currentTick: () => baseTick,
        },
    };
    server.npcManager = {
        getById(id: number) {
            return npcAlive && id === npc.id ? npc : undefined;
        },
        queueRespawn(npcId: number, respawnTick: number) {
            if (npcId !== npc.id || !npcAlive) return false;
            npcAlive = false;
            respawnQueue.push({ npcId: npcId, respawnTick: respawnTick });
            return true;
        },
        cancelRespawn(npcId: number) {
            const index = respawnQueue.findIndex((entry) => entry.npcId === npcId);
            if (index >= 0) {
                respawnQueue.splice(index, 1);
                npcAlive = true;
                return true;
            }
            return false;
        },
    };
    server.actionScheduler = {
        requestAction(playerId: number, req: any, currentTick: number) {
            const normalized = {
                playerId: playerId,
                req: {
                    kind: String(req.kind),
                    data: { ...(req.data ?? {}) },
                    delayTicks: Number.isFinite(req.delayTicks as number)
                        ? (req.delayTicks as number)
                        : 0,
                    groups: Array.isArray(req.groups)
                        ? req.groups.map((g: unknown) => String(g))
                        : [],
                },
                currentTick: currentTick,
            };

            actionRequests.push(normalized);
            return { ok: true, actionId: actionRequests.length };
        },
    };
    server.broadcast = (msg: string) => {
        try {
            broadcasts.push(JSON.parse(msg));
        } catch {
            // ignore malformed payloads in test context
        }
    };
    server.players = {
        getById(id: number) {
            return id === player.id ? player : undefined;
        },
        getInteractionState() {
            return { kind: "npcCombat", npcId: npc.id };
        },
        getSocketByPlayerId() {
            return {};
        },
        forEach(_cb: (client: any, ps: PlayerState) => void) {
            // no-op: we do not simulate connected clients in this harness
        },
    };

    return { server, player, npc, actionRequests, broadcasts, baseTick };
}

function extractHitsplatMessages(messages: Array<{ type: string; payload: any }>) {
    return messages.filter((msg) => msg?.type === "hitsplat");
}

function testMeleeCombatIntervalsMatchOsrsTicks() {
    const baseTick = 100;
    const harness = createCombatHarness(baseTick);

    const originalRandom = Math.random;
    const randomSequence = [0.9, 0.2, 0.4]; // hit succeeds, retaliate damage rolls low, player damage mid
    Math.random = () => {
        const next = randomSequence.shift();
        return next !== undefined ? next : 0.5;
    };

    try {
        const attackResult = (WSServer.prototype as any).executeCombatAttackAction.call(
            harness.server,
            harness.player,
            { npcId: harness.npc.id },
            baseTick,
        );
        assert.ok(attackResult?.ok, "combat.attack should succeed when target is adjacent");
        assert.strictEqual(
            attackResult.cooldownTicks,
            4,
            "default melee attack cooldown should be 4 ticks to match OSRS",
        );
        assert.deepStrictEqual(
            attackResult.groups,
            ["combat.attack"],
            "attack action should lock the combat.attack group",
        );

        assert.strictEqual(
            harness.actionRequests.length,
            1,
            "attack should schedule a single combat.playerHit request",
        );
        const hitRequest = harness.actionRequests[0];
        assert.strictEqual(hitRequest.playerId, harness.player.id);
        assert.strictEqual(hitRequest.req.kind, "combat.playerHit");
        // Populate deterministic hit payload (matches CombatSystem defaults)
        const hitData = {
            ...hitRequest.req.data,
            damage: 5,
            style: HITMARK_DAMAGE,
            retaliateDamage: 2,
            hitDelay: 1,
            retaliationDelay: 1,
            retaliationTotalDelay: 2,
        };
        assert.strictEqual(
            hitRequest.req.delayTicks,
            1,
            "melee hits should land 1 tick after swing",
        );
        assert.strictEqual(
            hitRequest.currentTick,
            baseTick,
            "hit scheduling should use the attack start tick",
        );
        assert.strictEqual(hitData.damage, 5, "deterministic damage roll should enqueue 5 damage");
        const queuedSeq = harness.player.popPendingSeq();
        assert.ok(queuedSeq, "default swing should enqueue an animation payload");
        assert.strictEqual(
            queuedSeq?.seqId,
            422,
            "default unarmed melee swing should queue animation 422",
        );
        assert.strictEqual(
            queuedSeq?.delay,
            0,
            "default swing animation should fire without additional delay",
        );

        const hitExecutionTick = hitRequest.currentTick + hitRequest.req.delayTicks;
        const hitResult = (WSServer.prototype as any).executeCombatPlayerHitAction.call(
            harness.server,
            harness.player,
            hitData,
            hitExecutionTick,
        );
        assert.ok(hitResult?.ok, "combat.playerHit should apply successfully");
        assert.strictEqual(
            harness.actionRequests.length,
            2,
            "player hit should enqueue an npc retaliation",
        );
        const hitsplatMessages = extractHitsplatMessages(harness.broadcasts);
        assert.strictEqual(hitsplatMessages.length, 1, "npc should receive exactly one hitsplat");
        const npcHitsplat = hitsplatMessages[0];
        assert.strictEqual(npcHitsplat.payload?.targetType, "npc");
        assert.strictEqual(npcHitsplat.payload?.targetId, harness.npc.id);
        assert.strictEqual(
            npcHitsplat.payload?.tick,
            hitExecutionTick,
            "npc hitsplat should broadcast on the scheduled hit tick",
        );
        assert.strictEqual(
            npcHitsplat.payload?.damage,
            5,
            "deterministic damage roll should broadcast as 5",
        );

        const retaliationRequest = harness.actionRequests[1];
        assert.strictEqual(retaliationRequest.req.kind, "combat.npcRetaliate");
        assert.strictEqual(
            retaliationRequest.req.delayTicks,
            1,
            "npc retaliation should trigger one tick after the player's hit",
        );
        assert.strictEqual(
            retaliationRequest.req.delayTicks + hitRequest.req.delayTicks,
            hitData.retaliationTotalDelay,
            "total retaliation timing should align with planned swing delay",
        );
        assert.strictEqual(
            retaliationRequest.currentTick,
            hitExecutionTick,
            "npc retaliation scheduling should start from the hit tick",
        );

        const retaliationExecutionTick =
            retaliationRequest.currentTick + retaliationRequest.req.delayTicks;
        assert.strictEqual(
            retaliationExecutionTick,
            baseTick + hitData.retaliationTotalDelay,
            "npc retaliation should land two ticks after the initial swing",
        );
        const retaliationResult = (WSServer.prototype as any).executeCombatNpcRetaliateAction.call(
            harness.server,
            harness.player,
            retaliationRequest.req.data,
            retaliationExecutionTick,
        );
        assert.ok(retaliationResult?.ok, "combat.npcRetaliate should apply successfully");

        const allHitsplats = extractHitsplatMessages(harness.broadcasts);
        assert.strictEqual(allHitsplats.length, 2, "player should receive a retaliatory hitsplat");
        const playerHitsplat = allHitsplats[1];
        assert.strictEqual(playerHitsplat.payload?.targetType, "player");
        assert.strictEqual(playerHitsplat.payload?.targetId, harness.player.id);
        assert.strictEqual(
            playerHitsplat.payload?.tick,
            retaliationExecutionTick,
            "player hitsplat should broadcast the tick the npc retaliation resolves",
        );
        assert.strictEqual(
            playerHitsplat.payload?.damage,
            2,
            "deterministic retaliation damage should resolve to 2",
        );

        assert.strictEqual(
            retaliationExecutionTick - hitExecutionTick,
            1,
            "retaliation hitsplat should be spaced one tick after the player's hit to mirror OSRS timing",
        );
        assert.strictEqual(
            hitExecutionTick - baseTick,
            1,
            "initial hitsplat should land one tick after the player swing to mirror OSRS timing",
        );
    } finally {
        Math.random = originalRandom;
    }
}

function main() {
    testMeleeCombatIntervalsMatchOsrsTicks();
    // eslint-disable-next-line no-console
    console.log("Combat interval tests passed.");
}

main();
