import { describe, expect, test } from "bun:test";

import { SidebarStore } from "../src/client/sidebar/SidebarStore";
import {
    buildBotSdkSteerCommand,
    extractBotSdkFeedbackFromChat,
} from "../src/client/sidebar/botSdkPanelUtils";
import { registerDefaultClientSidebarEntries } from "../src/client/sidebar/entries";

describe("Bot SDK sidebar helpers", () => {
    test("registers the Bot SDK entry in the default sidebar set", () => {
        const store = new SidebarStore();

        registerDefaultClientSidebarEntries(store);

        const entryIds = store.getState().entries.map((entry) => entry.id);
        expect(entryIds).toContain("bot_sdk");
        expect(entryIds.indexOf("plugin_hub")).toBeLessThan(entryIds.indexOf("bot_sdk"));
    });

    test("builds a steer command from normalized directive text", () => {
        expect(buildBotSdkSteerCommand("  follow   my player  ")).toBe("::steer follow my player");
        expect(buildBotSdkSteerCommand("")).toBeUndefined();
        expect(buildBotSdkSteerCommand("   ")).toBeUndefined();
    });

    test("extracts steering feedback from server chat responses", () => {
        expect(
            extractBotSdkFeedbackFromChat({
                messageType: "game",
                text: "Steered 3 agents.",
            }),
        ).toEqual({
            kind: "success",
            text: "Steered 3 agents.",
        });

        expect(
            extractBotSdkFeedbackFromChat({
                messageType: "game",
                text: "No connected 'scape agents to steer.",
            }),
        ).toEqual({
            kind: "error",
            text: "No connected 'scape agents to steer.",
        });

        expect(
            extractBotSdkFeedbackFromChat({
                messageType: "public",
                text: "Steered 3 agents.",
            }),
        ).toBeUndefined();
    });
});
