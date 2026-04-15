import { describe, expect, test } from "bun:test";

import { SidebarStore } from "../src/client/sidebar/SidebarStore";
import {
    appendBotSdkDirectiveContext,
    buildBotSdkSteerCommand,
    extractBotSdkFeedbackFromChat,
} from "../src/client/sidebar/botSdkPanelUtils";
import { registerDefaultClientSidebarEntries } from "../src/client/sidebar/entries";

describe("Bot SDK sidebar helpers", () => {
    test("registers the Bot SDK entry in the default sidebar set", () => {
        const store = new SidebarStore();

        registerDefaultClientSidebarEntries(store);

        const entries = store.getState().entries;
        const entryIds = entries.map((entry) => entry.id);
        expect(entryIds).toContain("bot_sdk");
        expect(entryIds.indexOf("plugin_hub")).toBeLessThan(entryIds.indexOf("bot_sdk"));
        expect(entries.find((entry) => entry.id === "notes")?.title).toBe("Journal");
    });

    test("builds a steer command from normalized directive text", () => {
        expect(buildBotSdkSteerCommand("  follow   my player  ")).toBe("::steer follow my player");
        expect(buildBotSdkSteerCommand("")).toBeUndefined();
        expect(buildBotSdkSteerCommand("   ")).toBeUndefined();
    });

    test("appends journal context to an existing directive draft", () => {
        expect(appendBotSdkDirectiveContext("", "[Agent Journal / Scripts]\nLoop")).toBe(
            "[Agent Journal / Scripts]\nLoop",
        );
        expect(
            appendBotSdkDirectiveContext("Follow me.", "[Agent Journal / People]\n- Banker"),
        ).toBe("Follow me.\n\n[Agent Journal / People]\n- Banker");
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
                messageType: "game",
                text: "Installed script on 2 agents.",
            }),
        ).toEqual({
            kind: "success",
            text: "Installed script on 2 agents.",
        });

        expect(
            extractBotSdkFeedbackFromChat({
                messageType: "game",
                text: "Bot SDK script error: Script schemaVersion must be 1.",
            }),
        ).toEqual({
            kind: "error",
            text: "Bot SDK script error: Script schemaVersion must be 1.",
        });

        expect(
            extractBotSdkFeedbackFromChat({
                messageType: "public",
                text: "Steered 3 agents.",
            }),
        ).toBeUndefined();
    });
});
