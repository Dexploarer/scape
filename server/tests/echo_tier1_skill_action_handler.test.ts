import assert from "assert";

import { SkillActionHandler } from "../src/game/actions/handlers/SkillActionHandler";

function createTestPlayer(overrides?: Partial<any>): any {
    const player: any = {
        id: 101,
        level: 0,
        tileX: 3200,
        tileY: 3200,
        queueOneShotSeqCalls: [] as number[],
        queueOneShotSeq(seqId: number): void {
            this.queueOneShotSeqCalls.push(seqId);
        },
        clearInteractionCalls: 0,
        clearInteraction(): void {
            this.clearInteractionCalls++;
        },
        stopAnimationCalls: 0,
        stopAnimation(): void {
            this.stopAnimationCalls++;
        },
        clearPathCalls: 0,
        clearPath(): void {
            this.clearPathCalls++;
        },
        clearWalkDestinationCalls: 0,
        clearWalkDestination(): void {
            this.clearWalkDestinationCalls++;
        },
    };
    return Object.assign(player, overrides ?? {});
}

function createSkillFailure(_player: any, message: string, reason: string): any {
    return {
        ok: false,
        reason,
        effects: [{ type: "message", text: message }],
    };
}

function testEchoPickaxeRerollAndFourthOreDepletion(): void {
    const player = createTestPlayer();
    const scheduled: any[] = [];
    const bankDeposits: Array<{ itemId: number; quantity: number }> = [];
    const miningXp: number[] = [];
    const markedDepletions: any[] = [];
    let bankSnapshots = 0;
    let depleted = false;

    const services: any = {
        getMiningRockById: () => ({
            id: "copper",
            level: 1,
            oreItemId: 436,
            xp: 17.5,
            swingTicks: 4,
            depletedLocId: 450,
            respawnTicks: { min: 5, max: 5 },
        }),
        getMiningRockDefinition: () => undefined,
        buildMiningTileKey: () => "mining-node",
        isMiningDepleted: () => depleted,
        isAdjacentToLoc: () => true,
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        collectCarriedItemIds: () => [25063],
        selectPickaxeByLevel: () => ({ id: 25112, animation: 8787, swingTicks: 4 }),
        hasInventorySlot: () => false,
        getCurrentTick: () => 200,
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        faceGatheringTarget: () => {},
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        rollMiningSuccess: () => false,
        addItemToBank: (_p: any, itemId: number, quantity: number) => {
            bankDeposits.push({ itemId: itemId, quantity: quantity });
            return true;
        },
        describeOre: () => "copper ore",
        awardSkillXp: (_p: any, _skillId: number, xp: number) => {
            miningXp.push(xp);
        },
        markMiningDepleted: (payload: any) => {
            markedDepletions.push(payload);
            depleted = true;
        },
        emitLocChange: () => {},
        queueBankSnapshot: () => {
            bankSnapshots++;
        },
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);
    const originalRandom = Math.random;
    try {
        Math.random = () => 0.4; // Force echo reroll success.

        const first = handler.executeSkillMiningAction(
            player,
            {
                started: true,
                rockId: "copper",
                rockLocId: 2090,
                depletedLocId: 450,
                tile: { x: 3200, y: 3200 },
                level: 0,
                echoMinedCount: 0,
            },
            200,
        );
        assert.strictEqual(first.ok, true, "first echo mine should succeed via reroll");
        assert.strictEqual(bankDeposits.length, 1, "ore should be auto-banked");
        assert.strictEqual(bankSnapshots, 1, "bank snapshot should be queued after banking");
        assert.strictEqual(markedDepletions.length, 0, "rock should not deplete before 4th ore");
        assert.strictEqual(scheduled.length, 1, "mining should continue after first ore");
        assert.strictEqual(
            (scheduled[0]?.data as any)?.echoMinedCount,
            1,
            "echo mined count should increment",
        );
        assert.strictEqual(
            (scheduled[0]?.data as any)?.depletedLocId,
            450,
            "scheduled mining action should preserve the depleted loc id",
        );

        scheduled.length = 0;
        const fourth = handler.executeSkillMiningAction(
            player,
            {
                started: true,
                rockId: "copper",
                rockLocId: 2090,
                depletedLocId: 450,
                tile: { x: 3200, y: 3200 },
                level: 0,
                echoMinedCount: 3,
            },
            200,
        );
        assert.strictEqual(fourth.ok, true, "fourth echo mine should still succeed");
        assert.strictEqual(markedDepletions.length, 1, "rock should deplete on the fourth ore");
        assert.strictEqual(
            player.clearInteractionCalls > 0,
            true,
            "depletion should stop the mining interaction",
        );
        assert.strictEqual(
            scheduled.length,
            0,
            "depleted rock should not schedule another mining action",
        );
        assert.strictEqual(bankDeposits.length, 2, "both ores should be auto-banked");
        assert.strictEqual(bankSnapshots, 2, "both ores should queue a bank snapshot");
        assert.strictEqual(
            miningXp.length,
            2,
            "mining xp should be awarded for each successful ore",
        );
    } finally {
        Math.random = originalRandom;
    }
}

function testMiningInitialSchedulePreservesDepletedLocId(): void {
    const player = createTestPlayer({ id: 109 });
    const scheduled: any[] = [];

    const services: any = {
        getMiningRockById: () => ({
            id: "tin",
            level: 1,
            oreItemId: 438,
            xp: 17.5,
            swingTicks: 4,
        }),
        getMiningRockDefinition: () => undefined,
        buildMiningTileKey: () => "tin-node",
        isMiningDepleted: () => false,
        isAdjacentToLoc: () => true,
        getSkill: () => ({ baseLevel: 50, boost: 0 }),
        collectCarriedItemIds: () => [1265],
        selectPickaxeByLevel: () => ({ id: 1265, animation: 625, swingTicks: 4 }),
        hasInventorySlot: () => true,
        getCurrentTick: () => 220,
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        faceGatheringTarget: () => {},
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);
    const result = handler.executeSkillMiningAction(
        player,
        {
            started: false,
            rockId: "tin",
            rockLocId: 11360,
            depletedLocId: 11390,
            tile: { x: 3200, y: 3200 },
            level: 0,
            echoMinedCount: 0,
        },
        220,
    );

    assert.strictEqual(result.ok, true, "initial mining click should schedule follow-up action");
    assert.strictEqual(scheduled.length, 1, "initial mining click should schedule one action");
    assert.strictEqual(
        (scheduled[0]?.data as any)?.depletedLocId,
        11390,
        "initial mining schedule should preserve depleted loc id",
    );
}

function testEchoHarpoonSubstitutesToolAutoCooksAndSpeedsFishing(): void {
    const player = createTestPlayer({ id: 102 });
    const scheduled: any[] = [];
    const bankDeposits: Array<{ itemId: number; quantity: number }> = [];
    const awardedXp: Array<{ skillId: number; xp: number }> = [];
    const requestedTools: any[] = [];
    let bankSnapshots = 0;

    const npc = {
        id: 7001,
        typeId: 1525,
        tileX: 3201,
        tileY: 3200,
        level: 0,
        size: 1,
    };

    const method = {
        id: "sea-bait",
        toolId: "fishing_rod",
        catches: [{ itemId: 317, level: 1, xp: 10 }],
        swingTicks: 5,
    };

    const services: any = {
        getNpc: () => npc,
        getFishingSpotById: () => ({ id: "sea_small_net", methods: [method] }),
        getFishingSpotDefinition: () => ({ id: "sea_small_net", methods: [method] }),
        getFishingMethodById: () => method,
        isAdjacentToNpc: () => true,
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        pickFishingCatch: () => ({ itemId: 317, level: 1, xp: 10, quantity: 1 }),
        collectCarriedItemIds: () => [25059],
        selectFishingTool: () => undefined,
        getFishingToolDefinition: (toolId: any) => {
            requestedTools.push(toolId);
            if (toolId === "harpoon") {
                return { id: "harpoon", name: "harpoon", animation: 618, swingTicks: 5 };
            }
            return { id: "fishing_rod", name: "fishing rod", animation: 622, swingTicks: 5 };
        },
        findInventorySlotWithItem: () => undefined,
        canStoreItem: () => false,
        playerHasItem: () => true,
        consumeItem: () => true,
        getCurrentTick: () => 300,
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        faceGatheringTarget: () => {},
        rollFishingSuccess: () => true,
        getCookingRecipeByRawItemId: () => ({
            id: "shrimp",
            name: "Shrimp",
            level: 1,
            rawItemId: 317,
            cookedItemId: 315,
            xp: 30,
        }),
        addItemToBank: (_p: any, itemId: number, quantity: number) => {
            bankDeposits.push({ itemId: itemId, quantity: quantity });
            return true;
        },
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        describeFish: () => "shrimp",
        awardSkillXp: (_p: any, skillId: number, xp: number) => {
            awardedXp.push({ skillId: skillId, xp });
        },
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        queueBankSnapshot: () => {
            bankSnapshots++;
        },
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);
    const originalRandom = Math.random;
    try {
        Math.random = () => 0.4; // Force auto-cook.
        const result = handler.executeSkillFishingAction(
            player,
            {
                started: true,
                npcId: npc.id,
                npcTypeId: npc.typeId,
                npcSize: npc.size,
                methodId: method.id,
            },
            300,
        );

        assert.strictEqual(result.ok, true, "echo fishing action should succeed");
        assert.ok(
            requestedTools.includes("harpoon"),
            "echo harpoon should substitute when required method tool is missing",
        );
        assert.deepStrictEqual(
            bankDeposits[0],
            { itemId: 315, quantity: 1 },
            "auto-cooked fish should be banked",
        );
        assert.strictEqual(bankSnapshots, 1, "auto-bank should queue a bank snapshot");
        assert.strictEqual(scheduled.length, 1, "fishing should continue");
        assert.strictEqual(
            scheduled[0]?.delayTicks,
            4,
            "echo harpoon should reduce fishing swing by one tick",
        );
        assert.strictEqual(
            awardedXp.some((entry) => entry.skillId === 10 && entry.xp === 10),
            true,
            "fishing xp should be awarded",
        );
        assert.strictEqual(
            awardedXp.some((entry) => entry.skillId === 7 && entry.xp === 30),
            true,
            "auto-cook should award cooking xp",
        );
        assert.strictEqual(
            result.effects.some(
                (effect: any) =>
                    effect?.type === "message" &&
                    String(effect?.text ?? "")
                        .toLowerCase()
                        .includes("catch and cook"),
            ),
            true,
            "success message should reflect auto-cooking",
        );
    } finally {
        Math.random = originalRandom;
    }
}

function testEchoAxeRerollAndAutoBanking(): void {
    const player = createTestPlayer({ id: 103 });
    const scheduled: any[] = [];
    const bankDeposits: Array<{ itemId: number; quantity: number }> = [];
    const woodcutXp: number[] = [];
    let bankSnapshots = 0;

    const services: any = {
        getWoodcuttingTreeById: () => ({
            id: "normal",
            level: 1,
            logItemId: 1511,
            xp: 25,
            swingTicks: 4,
            stumpId: 1342,
            respawnTicks: { min: 15, max: 15 },
        }),
        getWoodcuttingTreeDefinition: () => undefined,
        buildWoodcuttingTileKey: () => "woodcut-node",
        isWoodcuttingDepleted: () => false,
        isAdjacentToLoc: () => true,
        log: () => {},
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        collectCarriedItemIds: () => [25110],
        selectHatchetByLevel: () => ({ id: 25110, animation: 12025, swingTicks: 4 }),
        hasInventorySlot: () => false,
        getCurrentTick: () => 400,
        rollWoodcuttingSuccess: () => false,
        addItemToBank: (_p: any, itemId: number, quantity: number) => {
            bankDeposits.push({ itemId: itemId, quantity: quantity });
            return true;
        },
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        sendSound: () => {},
        describeLog: () => "logs",
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        awardSkillXp: (_p: any, _skillId: number, xp: number) => {
            woodcutXp.push(xp);
        },
        shouldDepleteTree: () => false,
        markWoodcuttingDepleted: () => {},
        emitLocChange: () => {},
        enqueueSoundBroadcast: () => {},
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        queueBankSnapshot: () => {
            bankSnapshots++;
        },
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);
    const originalRandom = Math.random;
    try {
        Math.random = () => 0.4; // Force reroll success when primary roll fails.
        const result = handler.executeSkillWoodcutAction(
            player,
            {
                started: true,
                treeId: "normal",
                treeLocId: 1276,
                tile: { x: 3200, y: 3200 },
                level: 0,
                ticksInSwing: 1, // next tick is roll tick (2)
            },
            400,
        );

        assert.strictEqual(result.ok, true, "echo woodcut action should succeed");
        assert.strictEqual(bankDeposits.length, 1, "logs should be auto-banked");
        assert.strictEqual(bankSnapshots, 1, "auto-bank should queue a bank snapshot");
        assert.strictEqual(woodcutXp.length, 1, "woodcutting xp should be awarded on success");
        assert.strictEqual(scheduled.length, 1, "woodcutting should continue");
    } finally {
        Math.random = originalRandom;
    }
}

testEchoPickaxeRerollAndFourthOreDepletion();
testMiningInitialSchedulePreservesDepletedLocId();
testEchoHarpoonSubstitutesToolAutoCooksAndSpeedsFishing();
testEchoAxeRerollAndAutoBanking();

console.log("Echo tier-1 SkillActionHandler tests passed.");
