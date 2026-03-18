import assert from "assert";

import { WidgetDialogHandler } from "../src/game/actions/handlers/WidgetDialogHandler";
import { InterfaceService } from "../src/widgets/InterfaceService";
import { PlayerWidgetManager, type WidgetAction } from "../src/widgets/WidgetManager";

function testNpcDialogRunsChatboxInitScriptsAfterMount(): void {
    const dispatchedWidgetActions: WidgetAction[] = [];
    const queuedScripts: Array<{
        playerId: number;
        scriptId: number;
        args: (number | string)[];
    }> = [];

    const player: any = {
        id: 321,
        displayMode: 0,
        widgets: new PlayerWidgetManager(),
    };
    player.widgets.setDispatcher((action: WidgetAction) => {
        dispatchedWidgetActions.push(action);
    });

    const interfaceService = new InterfaceService({
        queueWidgetEvent: (_playerId, event) => {
            dispatchedWidgetActions.push(event as WidgetAction);
        },
    });

    const handler = new WidgetDialogHandler(
        {
            getPlayer: () => player,
            getPlayerFromSocket: () => player,
            getCurrentTick: () => 0,
            queueWidgetEvent: (_playerId, event) => {
                dispatchedWidgetActions.push(event as WidgetAction);
            },
            queueClientScript: (playerId, scriptId, ...args) => {
                queuedScripts.push({ playerId, scriptId, args });
            },
            queueVarbit: () => {},
            queueWidgetAction: () => false,
            closeShopInterface: () => {},
            closeBank: () => {},
            queueSmithingInterfaceMessage: () => {},
            getShopGroupId: () => 300,
            getBankGroupId: () => 12,
            getSmithingGroupId: () => 312,
            log: () => {},
        },
        interfaceService,
    );

    handler.openDialog(player, {
        kind: "npc",
        id: "npc_dialog_test",
        npcId: 315,
        npcName: "League Tutor",
        lines: ["Welcome to Leagues."],
    });

    const openSub = dispatchedWidgetActions.find(
        (action) => action.action === "open_sub" && action.groupId === 231,
    );
    assert.ok(openSub, "npc dialog should open as a chatbox sub-interface");
    assert.deepStrictEqual(
        openSub?.preScripts,
        [{ scriptId: 2379, args: [] }],
        "npc dialog should still reset the chatbox before mount",
    );
    assert.deepStrictEqual(
        openSub?.postScripts,
        [
            {
                scriptId: 55,
                args: [(231 << 16) | 5, (231 << 16) | 1, 83, "", "", 255],
            },
            {
                scriptId: 600,
                args: [1, 1, 16, (231 << 16) | 6],
            },
        ],
        "npc dialog should install chatbox key and text-layout scripts only after mount",
    );

    assert.strictEqual(
        queuedScripts.some((entry) => entry.scriptId === 55 || entry.scriptId === 600),
        false,
        "chat dialog init scripts should be sent via open_sub postScripts rather than later run_script packets",
    );
}

testNpcDialogRunsChatboxInitScriptsAfterMount();
console.log("Widget dialog handler chatbox script ordering tests passed.");
