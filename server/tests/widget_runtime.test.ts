import assert from "assert";

import { InterfaceService } from "../src/widgets/InterfaceService";
import { DisplayMode, PlayerWidgetManager, type WidgetAction } from "../src/widgets/WidgetManager";

type WidgetCall = {
    playerId: number;
    event: { action: string; [key: string]: unknown };
};

function createPlayer(id: number): {
    id: number;
    displayMode: DisplayMode;
    widgets: PlayerWidgetManager;
} {
    return {
        id,
        displayMode: DisplayMode.RESIZABLE_NORMAL,
        widgets: new PlayerWidgetManager(),
    };
}

(function testInterfaceServiceUsesPlayerWidgetRuntimeForModalState() {
    const calls: WidgetCall[] = [];
    const player = createPlayer(1);
    const service = new InterfaceService({
        queueWidgetEvent: (playerId, event) => {
            calls.push({ playerId, event });
        },
    });

    service.openModal(player as any, 12, { source: "bank" });

    assert.equal(service.getCurrentModal(player as any), 12);
    assert.equal(player.widgets.getByScope("modal")?.groupId, 12);
    assert.deepEqual(service.getModalData(player as any), { source: "bank" });
    assert.ok(
        calls.some(
            (entry) =>
                entry.playerId === 1 &&
                entry.event.action === "open_sub" &&
                entry.event.groupId === 12,
        ),
        "openModal should dispatch through the shared widget runtime",
    );

    service.closeModal(player as any);

    assert.equal(service.getCurrentModal(player as any), undefined);
    assert.equal(player.widgets.getByScope("modal"), undefined);
    assert.ok(
        calls.some((entry) => entry.playerId === 1 && entry.event.action === "close_sub"),
        "closeModal should close through the shared widget runtime",
    );
})();

(function testTrackedCloseHooksReuseStoredEntryData() {
    const player = createPlayer(2);
    const service = new InterfaceService({
        queueWidgetEvent: () => {},
    });

    let closeData: unknown = undefined;
    service.onInterfaceClose(512, (_player, ctx) => {
        closeData = ctx.data;
    });

    service.openModal(player as any, 512, { tutorialStep: 5 });
    const closedEntries = player.widgets.closeModalInterfaces({ silent: true });
    service.triggerCloseHooksForEntries(player as any, closedEntries);

    assert.deepEqual(
        closeData,
        { tutorialStep: 5 },
        "external closes should preserve the tracked interface hook data",
    );
})();

(function testTrackedTargetReplacementClosesPreviousEntry() {
    const dispatched: WidgetAction[] = [];
    const widgets = new PlayerWidgetManager();
    widgets.setDispatcher((action) => {
        dispatched.push(action);
    });

    widgets.open(100, {
        targetUid: 12345,
        type: 0,
        modal: true,
    });
    widgets.open(200, {
        targetUid: 12345,
        type: 0,
        modal: true,
    });

    assert.equal(widgets.isOpen(100), false);
    assert.equal(widgets.isOpen(200), true);
    assert.equal(dispatched[0]?.action, "open_sub");
    assert.equal(dispatched[1]?.action, "close_sub");
    assert.equal(dispatched[2]?.action, "open_sub");
})();
