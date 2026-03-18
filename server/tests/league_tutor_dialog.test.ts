import assert from "assert";

import {
    VARBIT_FLASHSIDE,
    VARBIT_LEAGUE_RELIC_1,
    VARBIT_LEAGUE_TUTORIAL_COMPLETED,
    VARBIT_LEAGUE_TYPE,
} from "../../src/shared/vars";
import { PlayerInteractionSystem } from "../src/game/interactions/PlayerInteractionSystem";
import { leagueTutorModule } from "../src/game/scripts/modules/leagueTutor";

type RegisteredNpcScript = {
    npcId: number;
    option?: string;
    handler: (event: any) => void;
};

function testLeagueTutorModuleRegistersAndReopensTutorialOverlay(): void {
    const registeredNpcScripts: RegisteredNpcScript[] = [];
    const openedDialogs: any[] = [];
    const openedOptions: any[] = [];
    const closedDialogIds: string[] = [];
    const queuedWidgetEvents: any[] = [];
    const queuedVarps: any[] = [];
    const queuedVarbits: any[] = [];

    const registry: any = {
        registerNpcScript(params: RegisteredNpcScript): void {
            registeredNpcScripts.push(params);
        },
    };

    const varbits = new Map<number, number>([
        [VARBIT_LEAGUE_TYPE, 3],
        [VARBIT_LEAGUE_TUTORIAL_COMPLETED, 3],
        [VARBIT_FLASHSIDE, 0],
    ]);
    const varps = new Map<number, number>();
    const player: any = {
        id: 77,
        displayMode: 0,
        getVarbitValue: (id: number) => varbits.get(id) ?? 0,
        setVarbitValue: (id: number, value: number) => {
            varbits.set(id, value);
        },
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => {
            varps.set(id, value);
        },
    };

    const services: any = {
        openDialog: (_player: any, request: any) => {
            openedDialogs.push(request);
        },
        openDialogOptions: (_player: any, request: any) => {
            openedOptions.push(request);
        },
        closeDialog: (_player: any, dialogId?: string) => {
            if (dialogId) {
                closedDialogIds.push(dialogId);
            }
        },
        queueWidgetEvent: (playerId: number, event: any) => {
            queuedWidgetEvents.push({ playerId: playerId, event });
        },
        queueVarp: (playerId: number, varpId: number, value: number) => {
            queuedVarps.push({ playerId: playerId, varpId: varpId, value: value });
        },
        queueVarbit: (playerId: number, varbitId: number, value: number) => {
            queuedVarbits.push({
                playerId: playerId,
                varbitId: varbitId,
                value: value,
            });
        },
    };

    leagueTutorModule.register(registry, services);

    assert.strictEqual(
        registeredNpcScripts.some(
            (entry) => entry.npcId === 315 && String(entry.option) === "talk-to",
        ),
        true,
        "league tutor should register a talk-to script",
    );
    assert.strictEqual(
        registeredNpcScripts.some((entry) => entry.npcId === 315 && entry.option === undefined),
        true,
        "league tutor should register an undefined-option fallback script",
    );

    const talkToScript = registeredNpcScripts.find((entry) => entry.option === "talk-to");
    assert.ok(talkToScript, "talk-to script should exist");
    talkToScript!.handler({
        player,
        npc: { id: 9001, typeId: 315 },
        option: "talk-to",
        tick: 0,
        services,
    });

    assert.strictEqual(openedDialogs.length, 1, "league tutor should open an intro dialog");
    assert.strictEqual(
        openedDialogs[0].lines.some((line: string) =>
            String(line).toLowerCase().includes("welcome to leagues"),
        ),
        true,
        "intro dialog should contain leagues onboarding text",
    );

    openedDialogs[0].onContinue?.();
    assert.strictEqual(openedOptions.length, 1, "continuing intro should open option dialog");
    assert.strictEqual(
        openedOptions[0].options.includes("Reopen the tutorial panel."),
        true,
        "tutorial-active dialog should include reopen tutorial option",
    );
    assert.strictEqual(
        closedDialogIds.some((dialogId) => dialogId.includes("_intro")),
        true,
        "intro dialog should be closed before options open",
    );

    openedOptions[0].onSelect(3);
    assert.strictEqual(
        queuedWidgetEvents.length > 0,
        true,
        "reopen option should queue tutorial overlay widget events",
    );
    assert.strictEqual(
        queuedVarps.length > 0,
        true,
        "reopen option on tutorial step 3 should queue side journal state varp",
    );
    assert.strictEqual(
        queuedVarbits.some(
            (entry: any) => entry.varbitId === VARBIT_FLASHSIDE && entry.value === 3,
        ),
        true,
        "reopen option should queue the flashside varbit when opening step 3 overlay",
    );
    assert.strictEqual(
        openedDialogs.some((dialog) =>
            dialog.lines.some((line: string) =>
                String(line).toLowerCase().includes("reopened the tutorial panel"),
            ),
        ),
        true,
        "tutor should confirm tutorial overlay reopen to the player",
    );
}

function testLeagueTutorCanReclaimLostEchoTool(): void {
    const registeredNpcScripts: RegisteredNpcScript[] = [];
    const openedDialogs: any[] = [];
    const openedOptions: any[] = [];
    const addedItems: Array<{ itemId: number; qty: number }> = [];
    let inventorySnapshots = 0;

    const registry: any = {
        registerNpcScript(params: RegisteredNpcScript): void {
            registeredNpcScripts.push(params);
        },
    };

    const varbits = new Map<number, number>([
        [VARBIT_LEAGUE_TYPE, 3],
        [VARBIT_LEAGUE_TUTORIAL_COMPLETED, 14],
        [VARBIT_LEAGUE_RELIC_1, 1],
    ]);
    const player: any = {
        id: 79,
        displayMode: 0,
        getVarbitValue: (id: number) => varbits.get(id) ?? 0,
        setVarbitValue: (id: number, value: number) => {
            varbits.set(id, value);
        },
        getVarpValue: () => 0,
        setVarpValue: () => {},
    };

    // enum_2670: league_type -> league struct
    // league struct param_870 -> tier enum
    // tier enum key 0 -> tier 1 struct
    // tier 1 struct param_878 -> relic enum
    // relic enum key 1 -> relic struct
    // relic struct param_2049 -> reward object (echo axe)
    const enumData = new Map<number, any>([
        [2670, { keys: [3], intValues: [1001] }],
        [2001, { keys: [0], intValues: [3001] }],
        [4001, { keys: [1], intValues: [5001] }],
    ]);
    const structData = new Map<number, any>([
        [1001, { params: new Map([[870, 2001]]) }],
        [3001, { params: new Map([[878, 4001]]) }],
        [5001, { params: new Map([[2049, 25110]]) }],
    ]);

    const services: any = {
        getEnumTypeLoader: () => ({
            load: (id: number) => enumData.get(id),
        }),
        getStructTypeLoader: () => ({
            load: (id: number) => structData.get(id),
        }),
        findOwnedItemLocation: () => undefined,
        addItemToInventory: (_player: any, itemId: number, qty: number) => {
            addedItems.push({ itemId: itemId, qty: qty });
            return { slot: 0, added: 1 };
        },
        snapshotInventory: () => {
            inventorySnapshots++;
        },
        openDialog: (_player: any, request: any) => {
            openedDialogs.push(request);
        },
        openDialogOptions: (_player: any, request: any) => {
            openedOptions.push(request);
        },
        closeDialog: () => {},
    };

    leagueTutorModule.register(registry, services);
    const talkToScript = registeredNpcScripts.find((entry) => entry.option === "talk-to");
    assert.ok(talkToScript, "talk-to script should exist");
    talkToScript!.handler({
        player,
        npc: { id: 9004, typeId: 315 },
        option: "talk-to",
        tick: 0,
        services,
    });
    openedDialogs[0].onContinue?.();
    openedOptions[0].onSelect(2); // "I've lost my Echo tool."

    assert.deepStrictEqual(
        addedItems[0],
        { itemId: 25110, qty: 1 },
        "league tutor should restore the tier-1 echo tool reward item",
    );
    assert.strictEqual(
        inventorySnapshots,
        1,
        "reclaiming a lost echo tool should snapshot inventory",
    );
    assert.strictEqual(
        openedDialogs.some((dialog) =>
            dialog.lines.some((line: string) =>
                String(line).toLowerCase().includes("replaced your lost echo tool"),
            ),
        ),
        true,
        "tutor should confirm lost echo tool replacement",
    );
}

function testLeagueTutorSkipsReclaimWhenEchoToolInBank(): void {
    const registeredNpcScripts: RegisteredNpcScript[] = [];
    const openedDialogs: any[] = [];
    const openedOptions: any[] = [];
    const addedItems: Array<{ itemId: number; qty: number }> = [];

    const registry: any = {
        registerNpcScript(params: RegisteredNpcScript): void {
            registeredNpcScripts.push(params);
        },
    };

    const varbits = new Map<number, number>([
        [VARBIT_LEAGUE_TYPE, 3],
        [VARBIT_LEAGUE_TUTORIAL_COMPLETED, 14],
        [VARBIT_LEAGUE_RELIC_1, 1],
    ]);
    const player: any = {
        id: 80,
        displayMode: 0,
        getVarbitValue: (id: number) => varbits.get(id) ?? 0,
        setVarbitValue: (id: number, value: number) => {
            varbits.set(id, value);
        },
        getVarpValue: () => 0,
        setVarpValue: () => {},
    };

    const enumData = new Map<number, any>([
        [2670, { keys: [3], intValues: [1001] }],
        [2001, { keys: [0], intValues: [3001] }],
        [4001, { keys: [1], intValues: [5001] }],
    ]);
    const structData = new Map<number, any>([
        [1001, { params: new Map([[870, 2001]]) }],
        [3001, { params: new Map([[878, 4001]]) }],
        [5001, { params: new Map([[2049, 25110]]) }],
    ]);

    const services: any = {
        getEnumTypeLoader: () => ({
            load: (id: number) => enumData.get(id),
        }),
        getStructTypeLoader: () => ({
            load: (id: number) => structData.get(id),
        }),
        findOwnedItemLocation: (_player: any, itemId: number) =>
            itemId === 25110 ? "bank" : undefined,
        addItemToInventory: (_player: any, itemId: number, qty: number) => {
            addedItems.push({ itemId: itemId, qty: qty });
            return { slot: 0, added: 1 };
        },
        snapshotInventory: () => {},
        openDialog: (_player: any, request: any) => {
            openedDialogs.push(request);
        },
        openDialogOptions: (_player: any, request: any) => {
            openedOptions.push(request);
        },
        closeDialog: () => {},
    };

    leagueTutorModule.register(registry, services);
    const talkToScript = registeredNpcScripts.find((entry) => entry.option === "talk-to");
    assert.ok(talkToScript, "talk-to script should exist");
    talkToScript!.handler({
        player,
        npc: { id: 9005, typeId: 315 },
        option: "talk-to",
        tick: 0,
        services,
    });
    openedDialogs[0].onContinue?.();
    openedOptions[0].onSelect(2); // "I've lost my Echo tool."

    assert.strictEqual(
        addedItems.length,
        0,
        "league tutor should not reclaim a duplicate echo tool when one exists in bank",
    );
    assert.strictEqual(
        openedDialogs.some((dialog) =>
            dialog.lines.some((line: string) =>
                String(line).toLowerCase().includes("stored in your bank"),
            ),
        ),
        true,
        "tutor should explain that the echo tool already exists in bank",
    );
}

function testLeagueTutorTalkAllowedDuringTutorialInteractionLock(): void {
    const ws = { id: "socket-1" };
    const player: any = {
        id: 88,
        level: 0,
        tileX: 3200,
        tileY: 3200,
        runToggle: false,
        runEnergy: 100,
        canInteract: () => false,
        interruptQueues: () => {},
        resetInteractions: () => {},
        clearPath: () => {},
        clearInteraction: () => {},
        stopAnimation: () => {},
        removeCombatTarget: () => {},
        setInteractingNpc: () => {},
        setInteractingPlayer: () => {},
    };
    const players: any = {
        get: (socket: any) => (socket === ws ? player : undefined),
        getById: () => undefined,
        getSocketByPlayerId: () => undefined,
        forEach: () => {},
        forEachBot: () => {},
    };
    const pathService: any = {
        getCollisionFlagAt: () => 0,
    };

    const interactionSystem = new PlayerInteractionSystem(players, pathService);
    const tutorNpc: any = {
        id: 9002,
        typeId: 315,
        tileX: 3201,
        tileY: 3200,
        level: 0,
        size: 1,
        getHitpoints: () => 10,
    };
    const otherNpc: any = {
        id: 9003,
        typeId: 316,
        tileX: 3201,
        tileY: 3200,
        level: 0,
        size: 1,
        getHitpoints: () => 10,
    };

    const allowed = interactionSystem.startNpcInteraction(ws, tutorNpc, "talk-to");
    assert.strictEqual(allowed.ok, true, "league tutor talk-to should bypass tutorial lock");

    const blocked = interactionSystem.startNpcInteraction(ws, otherNpc, "talk-to");
    assert.strictEqual(
        blocked.ok,
        false,
        "non-league-tutor npc should remain blocked during tutorial lock",
    );
    assert.strictEqual(blocked.message, "interaction_blocked");
}

function testLeagueTutorSkipsReclaimWhenEchoToolEquipped(): void {
    const registeredNpcScripts: RegisteredNpcScript[] = [];
    const openedDialogs: any[] = [];
    const openedOptions: any[] = [];
    const addedItems: Array<{ itemId: number; qty: number }> = [];

    const registry: any = {
        registerNpcScript(params: RegisteredNpcScript): void {
            registeredNpcScripts.push(params);
        },
    };

    const varbits = new Map<number, number>([
        [VARBIT_LEAGUE_TYPE, 3],
        [VARBIT_LEAGUE_TUTORIAL_COMPLETED, 14],
        [VARBIT_LEAGUE_RELIC_1, 1],
    ]);
    const player: any = {
        id: 81,
        displayMode: 0,
        getVarbitValue: (id: number) => varbits.get(id) ?? 0,
        setVarbitValue: (id: number, value: number) => {
            varbits.set(id, value);
        },
        getVarpValue: () => 0,
        setVarpValue: () => {},
    };

    const enumData = new Map<number, any>([
        [2670, { keys: [3], intValues: [1001] }],
        [2001, { keys: [0], intValues: [3001] }],
        [4001, { keys: [1], intValues: [5001] }],
    ]);
    const structData = new Map<number, any>([
        [1001, { params: new Map([[870, 2001]]) }],
        [3001, { params: new Map([[878, 4001]]) }],
        [5001, { params: new Map([[2049, 25110]]) }],
    ]);

    const services: any = {
        getEnumTypeLoader: () => ({
            load: (id: number) => enumData.get(id),
        }),
        getStructTypeLoader: () => ({
            load: (id: number) => structData.get(id),
        }),
        findOwnedItemLocation: (_player: any, itemId: number) =>
            itemId === 25110 ? "equipment" : undefined,
        addItemToInventory: (_player: any, itemId: number, qty: number) => {
            addedItems.push({ itemId: itemId, qty: qty });
            return { slot: 0, added: 1 };
        },
        snapshotInventory: () => {},
        openDialog: (_player: any, request: any) => {
            openedDialogs.push(request);
        },
        openDialogOptions: (_player: any, request: any) => {
            openedOptions.push(request);
        },
        closeDialog: () => {},
    };

    leagueTutorModule.register(registry, services);
    const talkToScript = registeredNpcScripts.find((entry) => entry.option === "talk-to");
    assert.ok(talkToScript, "talk-to script should exist");
    talkToScript!.handler({
        player,
        npc: { id: 9006, typeId: 315 },
        option: "talk-to",
        tick: 0,
        services,
    });
    openedDialogs[0].onContinue?.();
    openedOptions[0].onSelect(2); // "I've lost my Echo tool."

    assert.strictEqual(
        addedItems.length,
        0,
        "league tutor should not reclaim a duplicate when the echo tool is equipped",
    );
    assert.strictEqual(
        openedDialogs.some((dialog) =>
            dialog.lines.some((line: string) =>
                String(line).toLowerCase().includes("already have your echo tool equipped"),
            ),
        ),
        true,
        "tutor should explain that the echo tool is currently equipped",
    );
}

testLeagueTutorModuleRegistersAndReopensTutorialOverlay();
testLeagueTutorCanReclaimLostEchoTool();
testLeagueTutorSkipsReclaimWhenEchoToolInBank();
testLeagueTutorSkipsReclaimWhenEchoToolEquipped();
testLeagueTutorTalkAllowedDuringTutorialInteractionLock();

console.log("League tutor dialog tests passed.");
