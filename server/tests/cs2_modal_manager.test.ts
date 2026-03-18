import assert from "assert";

import {
    VOTE_MODAL_COMPONENT_CLOSE_BUTTON,
    VOTE_MODAL_COMPONENT_FRAME,
    VOTE_MODAL_COMPONENT_NOTE,
    VOTE_MODAL_COMPONENT_PROGRESS_SEGMENT_1,
    VOTE_MODAL_COMPONENT_PROGRESS_TEXT,
    VOTE_MODAL_COMPONENT_REWARD,
    VOTE_MODAL_COMPONENT_REWARD_ICON_CHEST,
    VOTE_MODAL_COMPONENT_REWARD_TRAIL_LEFT,
    VOTE_MODAL_COMPONENT_ROW_TOPG,
    VOTE_MODAL_COMPONENT_SITE_RUNELIST,
    VOTE_MODAL_COMPONENT_SITE_TOPG,
    VOTE_MODAL_COMPONENT_STATUS_TOPG,
    VOTE_MODAL_COMPONENT_TIMER_HINT,
    VOTE_MODAL_COMPONENT_TITLE,
    VOTE_MODAL_GROUP_ID,
} from "../../src/shared/ui/voteModal";
import { Cs2ModalManager } from "../src/network/managers/Cs2ModalManager";

type ModalCall = { playerId: number; interfaceId: number; data?: unknown };
type WidgetEventCall = { playerId: number; event: any };

function uid(groupId: number, componentId: number): number {
    return (groupId << 16) | (componentId & 0xffff);
}

function testVoteModalFlow(): void {
    const openCalls: ModalCall[] = [];
    const closeCalls: number[] = [];
    const widgetCalls: WidgetEventCall[] = [];
    const messages: Array<{ playerId: number; text: string }> = [];
    const currentModalByPlayer = new Map<number, number | undefined>();

    const manager = new Cs2ModalManager({
        openModal: (player, interfaceId, data) => {
            const playerId = player.id;
            openCalls.push({ playerId, interfaceId: interfaceId, data });
            currentModalByPlayer.set(playerId, interfaceId);
        },
        closeModal: (player) => {
            const playerId = player.id;
            closeCalls.push(playerId);
            currentModalByPlayer.delete(playerId);
        },
        getCurrentModal: (player) => currentModalByPlayer.get(player.id),
        queueWidgetEvent: (playerId, event) => {
            widgetCalls.push({ playerId: playerId, event });
        },
        queueGameMessage: (playerId, text) => {
            messages.push({ playerId: playerId, text: String(text ?? "") });
        },
    });

    const player = { id: 77, name: "Tester" } as any;
    manager.openVoteModal(player);

    assert.equal(openCalls.length, 1, "vote modal should open once");
    assert.equal(
        openCalls[0].interfaceId,
        VOTE_MODAL_GROUP_ID,
        "vote modal should use custom vote group",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 3737 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_FRAME) &&
                entry.event.args[1] === "Vote Sites",
        ),
        "vote modal should initialize steelborder frame script",
    );
    assert.equal(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                (entry.event.scriptId === 353 ||
                    entry.event.scriptId === 355 ||
                    entry.event.scriptId === 2413),
        ),
        false,
        "vote modal should not draw extra inner panel frames",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_text" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_TITLE) &&
                String(entry.event.text).includes("Daily Vote Rewards"),
        ),
        "vote modal should show a rewards section title",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_text" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_REWARD) &&
                String(entry.event.text).includes("Rewards:"),
        ),
        "vote modal should initialize rewards text",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 5843 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_REWARD_TRAIL_LEFT),
        ),
        "vote modal should start reward trail pulse animation",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 5843 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_REWARD_ICON_CHEST),
        ),
        "vote modal should start reward icon pulse animation",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_hidden" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_TIMER_HINT) &&
                entry.event.hidden === true,
        ),
        "vote modal should hide timer helper row",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_text" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_NOTE) &&
                String(entry.event.text).toLowerCase().includes("links are posted in chat"),
        ),
        "vote modal should initialize chat safety note",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_text" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_SITE_TOPG) &&
                String(entry.event.text).includes("TopG"),
        ),
        "vote modal should initialize site name row",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 2979 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG) &&
                String(entry.event.args[6]) === "Vote",
        ),
        "vote modal should initialize site status button",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 229 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG) &&
                entry.event.args[1] === 9 &&
                entry.event.args[2] === 426,
        ),
        "vote modal should set ready status icon through cc_graphic_swapper",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_text" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_PROGRESS_TEXT) &&
                String(entry.event.text).includes("0/3"),
        ),
        "vote modal should initialize progress text",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "set_hidden" &&
                entry.event.uid ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_PROGRESS_SEGMENT_1) &&
                entry.event.hidden === true,
        ),
        "vote modal should initialize progress segments hidden for zero completion",
    );
    const rewardPulseCallCountBeforeVote = widgetCalls.filter(
        (entry) =>
            entry.playerId === 77 &&
            entry.event.action === "run_script" &&
            entry.event.scriptId === 5843 &&
            Array.isArray(entry.event.args) &&
            entry.event.args[0] ===
                uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_REWARD_ICON_CHEST),
    ).length;

    assert.equal(
        manager.handleWidgetAction(player, VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_SITE_TOPG),
        true,
        "topg row should be handled",
    );
    assert.ok(
        messages.some((entry) => entry.text.includes("Test vote recorded for TopG")),
        "topg row should mark TopG as voted for testing",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 5843 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_REWARD_ICON_CHEST),
        ),
        "vote action should trigger reward pulse animation feedback",
    );
    const rewardPulseCallCountAfterVote = widgetCalls.filter(
        (entry) =>
            entry.playerId === 77 &&
            entry.event.action === "run_script" &&
            entry.event.scriptId === 5843 &&
            Array.isArray(entry.event.args) &&
            entry.event.args[0] ===
                uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_REWARD_ICON_CHEST),
    ).length;
    assert.ok(
        rewardPulseCallCountAfterVote > rewardPulseCallCountBeforeVote,
        "vote action should emit additional reward pulse scripts",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 2979 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG) &&
                /^In \d{2}:\d{2}:\d{2}$/.test(String(entry.event.args[6] ?? "")),
        ),
        "topg row should switch status button label to countdown timer after vote",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 77 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 229 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG) &&
                entry.event.args[1] === 9 &&
                entry.event.args[2] === 941,
        ),
        "topg row should swap to cooldown status icon via cc_graphic_swapper",
    );
    assert.equal(
        manager.handleWidgetAction(player, VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG),
        true,
        "topg status column should be handled",
    );
    assert.equal(
        manager.handleWidgetAction(player, VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_ROW_TOPG),
        true,
        "topg row background should be handled",
    );

    assert.equal(
        manager.handleWidgetAction(player, VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_SITE_RUNELIST),
        true,
        "runelist row should be handled",
    );
    assert.ok(
        messages.some((entry) => entry.text.includes("Test vote recorded for RuneList")),
        "runelist row should mark RuneList as voted for testing",
    );

    assert.equal(
        manager.handleWidgetAction(player, VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_CLOSE_BUTTON),
        true,
        "close component should be handled",
    );
    assert.equal(closeCalls.length, 1, "close should close modal exactly once");
    assert.equal(
        manager.handleWidgetAction(player, VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_SITE_TOPG),
        false,
        "no actions should be handled after modal closes",
    );
}

function testVoteModalCooldownFooter(): void {
    const widgetCalls: WidgetEventCall[] = [];

    const manager = new Cs2ModalManager({
        openModal: () => {},
        closeModal: () => {},
        getCurrentModal: () => VOTE_MODAL_GROUP_ID,
        queueWidgetEvent: (playerId, event) => {
            widgetCalls.push({ playerId: playerId, event });
        },
        queueGameMessage: () => {},
    });

    const player = {
        id: 91,
        __voteSiteCooldowns: {
            topg: 90 * 60,
        },
    } as any;
    manager.openVoteModal(player);

    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 91 &&
                entry.event.action === "set_hidden" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_TIMER_HINT) &&
                entry.event.hidden === false,
        ),
        "vote modal should show cooldown footer when any site is on cooldown",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 91 &&
                entry.event.action === "set_text" &&
                entry.event.uid === uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_TIMER_HINT) &&
                String(entry.event.text).includes("Cooldown text shows"),
        ),
        "vote modal should set cooldown footer text when cooldown is active",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 91 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 2979 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG) &&
                /^In \d{2}:\d{2}:\d{2}$/.test(String(entry.event.args[6] ?? "")),
        ),
        "vote modal should render cooldown status button text for the affected site",
    );
    assert.ok(
        widgetCalls.some(
            (entry) =>
                entry.playerId === 91 &&
                entry.event.action === "run_script" &&
                entry.event.scriptId === 229 &&
                Array.isArray(entry.event.args) &&
                entry.event.args[0] ===
                    uid(VOTE_MODAL_GROUP_ID, VOTE_MODAL_COMPONENT_STATUS_TOPG) &&
                entry.event.args[1] === 9 &&
                entry.event.args[2] === 941,
        ),
        "vote modal should render cooldown status icon through cc_graphic_swapper",
    );
}

function main(): void {
    testVoteModalFlow();
    testVoteModalCooldownFooter();
    console.log("\n✓ cs2 modal manager vote flow");
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
