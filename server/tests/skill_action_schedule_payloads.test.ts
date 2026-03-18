import assert from "assert";

import { SkillActionHandler } from "../src/game/actions/handlers/SkillActionHandler";

function createPlayer(overrides?: Partial<any>): any {
    const player: any = {
        id: 9001,
        level: 0,
        tileX: 3200,
        tileY: 3200,
        queueOneShotSeq: () => {},
        clearInteraction: () => {},
        stopAnimation: () => {},
        clearPath: () => {},
        clearWalkDestination: () => {},
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

function testMiningSchedulePayloads(): void {
    const player = createPlayer();
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
        buildMiningTileKey: () => "mine-key",
        isMiningDepleted: () => false,
        isAdjacentToLoc: () => true,
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        collectCarriedItemIds: () => [1265],
        selectPickaxeByLevel: () => ({
            itemId: 1265,
            level: 1,
            animation: 625,
            accuracy: 3,
            swingTicks: 4,
        }),
        hasInventorySlot: () => true,
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        faceGatheringTarget: () => {},
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        rollMiningSuccess: () => false,
        addItemToBank: () => true,
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        describeOre: () => "ore",
        awardSkillXp: () => {},
        markMiningDepleted: () => {},
        emitLocChange: () => {},
        queueBankSnapshot: () => {},
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);

    handler.executeSkillMiningAction(
        player,
        {
            rockId: "tin",
            rockLocId: 11360,
            depletedLocId: 11390,
            tile: { x: 3200, y: 3200 },
            level: 0,
            started: false,
            echoMinedCount: 0,
        },
        100,
    );
    assert.strictEqual(scheduled.length, 1, "initial mining should schedule follow-up");
    assert.strictEqual(scheduled[0].kind, "skill.mine");
    assert.strictEqual(scheduled[0].data.depletedLocId, 11390);
    assert.strictEqual(scheduled[0].data.echoMinedCount, 0);
    assert.strictEqual(scheduled[0].data.started, true);

    scheduled.length = 0;
    handler.executeSkillMiningAction(
        player,
        {
            rockId: "tin",
            rockLocId: 11360,
            depletedLocId: 11390,
            tile: { x: 3200, y: 3200 },
            level: 0,
            started: true,
            echoMinedCount: 2,
        },
        101,
    );
    assert.strictEqual(scheduled.length, 1, "ongoing mining should reschedule");
    assert.strictEqual(scheduled[0].kind, "skill.mine");
    assert.strictEqual(scheduled[0].data.depletedLocId, 11390);
    assert.strictEqual(scheduled[0].data.echoMinedCount, 2);
    assert.strictEqual(scheduled[0].data.started, true);
}

function testFishingSchedulePayloads(): void {
    const player = createPlayer({ level: 0 });
    const scheduled: any[] = [];
    const npc = { id: 1525, typeId: 1525, tileX: 3201, tileY: 3200, level: 0, size: 1 };
    const method = {
        id: "small-net",
        toolId: "small_net",
        swingTicks: 4,
        catches: [{ itemId: 317, level: 1, xp: 10, weight: 100 }],
    };
    const tool = {
        id: "small_net",
        name: "small fishing net",
        itemIds: [303],
        animation: 621,
        swingTicks: 4,
        accuracy: 6,
    };

    const services: any = {
        getNpc: () => npc,
        getFishingSpotById: () => ({ id: "sea_small_net", methods: [method] }),
        getFishingSpotDefinition: () => ({ id: "sea_small_net", methods: [method] }),
        getFishingMethodById: () => method,
        isAdjacentToNpc: () => true,
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        pickFishingCatch: () => ({ itemId: 317, level: 1, xp: 10, quantity: 1 }),
        collectCarriedItemIds: () => [303],
        selectFishingTool: () => tool,
        getFishingToolDefinition: () => tool,
        findInventorySlotWithItem: () => undefined,
        canStoreItem: () => true,
        playerHasItem: () => true,
        consumeItem: () => true,
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        faceGatheringTarget: () => {},
        rollFishingSuccess: () => false,
        addItemToBank: () => true,
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        describeFish: () => "fish",
        awardSkillXp: () => {},
        getCookingRecipeByRawItemId: () => undefined,
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        queueBankSnapshot: () => {},
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);

    handler.executeSkillFishingAction(
        player,
        {
            npcId: npc.id,
            npcTypeId: npc.typeId,
            npcSize: npc.size,
            spotId: "sea_small_net",
            methodId: method.id,
            level: 0,
            started: false,
        },
        200,
    );
    assert.strictEqual(scheduled.length, 1, "initial fishing should schedule follow-up");
    assert.strictEqual(scheduled[0].kind, "skill.fish");
    assert.strictEqual(scheduled[0].data.npcId, npc.id);
    assert.strictEqual(scheduled[0].data.npcTypeId, npc.typeId);
    assert.strictEqual(scheduled[0].data.npcSize, npc.size);
    assert.strictEqual(scheduled[0].data.methodId, method.id);
    assert.strictEqual(scheduled[0].data.started, true);

    scheduled.length = 0;
    handler.executeSkillFishingAction(
        player,
        {
            npcId: npc.id,
            npcTypeId: npc.typeId,
            npcSize: npc.size,
            spotId: "sea_small_net",
            methodId: method.id,
            level: 0,
            started: true,
        },
        201,
    );
    assert.strictEqual(scheduled.length, 1, "ongoing fishing should reschedule");
    assert.strictEqual(scheduled[0].kind, "skill.fish");
    assert.strictEqual(scheduled[0].data.npcId, npc.id);
    assert.strictEqual(scheduled[0].data.npcTypeId, npc.typeId);
    assert.strictEqual(scheduled[0].data.npcSize, npc.size);
    assert.strictEqual(scheduled[0].data.methodId, method.id);
    assert.strictEqual(scheduled[0].data.started, true);
}

function testFiremakingSchedulePayloads(): void {
    const player = createPlayer();
    const scheduled: any[] = [];
    const services: any = {
        getFiremakingLogDefinition: () => ({
            logId: 1511,
            level: 1,
            xp: 40,
            burnTicks: 75,
            fireObjectId: 26185,
        }),
        playerHasTinderbox: () => true,
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        isTileLit: () => false,
        isFiremakingTileBlocked: () => false,
        faceGatheringTarget: () => {},
        rollFiremakingSuccess: () => false,
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        computeFireLightingDelayTicks: () => 4,
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        consumeFiremakingLog: () => undefined,
        describeLog: () => "logs",
        awardSkillXp: () => {},
        lightFire: () => ({ fireObjectId: 26185 }),
        emitLocChange: () => {},
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);

    handler.executeSkillFiremakingAction(
        player,
        {
            logItemId: 1511,
            tile: { x: 3200, y: 3200 },
            level: 0,
            slot: 0,
            started: false,
            attempts: 0,
            previousLocId: 12,
        },
        300,
    );
    assert.strictEqual(scheduled.length, 1, "initial firemaking should schedule follow-up");
    assert.strictEqual(scheduled[0].kind, "skill.firemaking");
    assert.strictEqual(scheduled[0].data.previousLocId, 12);
    assert.strictEqual(scheduled[0].data.attempts, 1);
    assert.strictEqual(scheduled[0].data.started, true);

    scheduled.length = 0;
    handler.executeSkillFiremakingAction(
        player,
        {
            logItemId: 1511,
            tile: { x: 3200, y: 3200 },
            level: 0,
            slot: 0,
            started: true,
            attempts: 2,
            previousLocId: 34,
        },
        301,
    );
    assert.strictEqual(scheduled.length, 1, "ongoing firemaking should reschedule");
    assert.strictEqual(scheduled[0].kind, "skill.firemaking");
    assert.strictEqual(scheduled[0].data.previousLocId, 34);
    assert.strictEqual(scheduled[0].data.attempts, 3);
    assert.strictEqual(scheduled[0].data.started, true);
}

function testWoodcuttingSchedulePayloads(): void {
    const player = createPlayer();
    const scheduled: any[] = [];
    const services: any = {
        getWoodcuttingTreeById: () => ({
            id: "oak",
            level: 15,
            logItemId: 1521,
            xp: 37.5,
            swingTicks: 4,
            stumpId: 1356,
            respawnTicks: 30,
        }),
        getWoodcuttingTreeDefinition: () => undefined,
        buildWoodcuttingTileKey: () => "wood-key",
        isWoodcuttingDepleted: () => false,
        isAdjacentToLoc: () => true,
        log: () => {},
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        collectCarriedItemIds: () => [1351],
        selectHatchetByLevel: () => ({
            id: 1351,
            name: "bronze axe",
            level: 1,
            animation: 879,
            swingTicks: 3,
        }),
        hasInventorySlot: () => true,
        faceGatheringTarget: () => {},
        buildSkillMessageEffect: (_p: any, message: string) => ({ type: "message", text: message }),
        scheduleAction: (_playerId: number, request: any) => {
            scheduled.push(request);
            return { ok: true };
        },
        rollWoodcuttingSuccess: () => false,
        addItemToBank: () => true,
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        sendSound: () => {},
        describeLog: () => "logs",
        awardSkillXp: () => {},
        shouldDepleteTree: () => false,
        markWoodcuttingDepleted: () => {},
        emitLocChange: () => {},
        enqueueSoundBroadcast: () => {},
        queueBankSnapshot: () => {},
        buildSkillFailure: createSkillFailure,
    };

    const handler = new SkillActionHandler(services);

    handler.executeSkillWoodcutAction(
        player,
        {
            treeId: "oak",
            treeLocId: 1276,
            stumpId: 1356,
            tile: { x: 3200, y: 3200 },
            level: 0,
            started: false,
            ticksInSwing: 0,
        },
        400,
    );
    assert.strictEqual(scheduled.length, 1, "initial woodcutting should schedule follow-up");
    assert.strictEqual(scheduled[0].kind, "skill.woodcut");
    assert.strictEqual(scheduled[0].data.stumpId, 1356);
    assert.strictEqual(scheduled[0].data.ticksInSwing, 0);
    assert.strictEqual(scheduled[0].data.started, true);

    scheduled.length = 0;
    handler.executeSkillWoodcutAction(
        player,
        {
            treeId: "oak",
            treeLocId: 1276,
            stumpId: 1356,
            tile: { x: 3200, y: 3200 },
            level: 0,
            started: true,
            ticksInSwing: 0,
        },
        401,
    );
    assert.strictEqual(scheduled.length, 1, "ongoing woodcutting should reschedule");
    assert.strictEqual(scheduled[0].kind, "skill.woodcut");
    assert.strictEqual(scheduled[0].data.stumpId, 1356);
    assert.strictEqual(scheduled[0].data.ticksInSwing, 1);
    assert.strictEqual(scheduled[0].data.started, true);
}

testMiningSchedulePayloads();
testFishingSchedulePayloads();
testFiremakingSchedulePayloads();
testWoodcuttingSchedulePayloads();

console.log("Skill action schedule payload tests passed.");
