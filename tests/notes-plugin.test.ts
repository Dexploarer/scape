import { describe, expect, test } from "bun:test";

import { NotesPlugin } from "../src/client/plugins/notes/NotesPlugin";

describe("NotesPlugin", () => {
    test("migrates legacy notes into the memories journal section", () => {
        const plugin = new NotesPlugin({
            load: () => ({ notes: "Banker owes us a favor." }),
            save: () => {},
        });

        expect(plugin.getConfig()).toEqual({
            enabled: true,
            activeTab: "scripts",
            journal: {
                scripts: "",
                people: "",
                memories: "Banker owes us a favor.",
                financialStatus: "",
            },
            scriptProposals: [],
            scriptActivity: [],
        });
    });

    test("persists journal tab updates and section content", () => {
        let savedConfig = pluginSnapshot();
        const plugin = new NotesPlugin({
            load: () => undefined,
            save: (config) => {
                savedConfig = config;
            },
        });

        plugin.setJournalEntry("scripts", "Train shrimp fishing until inventory is full.");
        plugin.setJournalEntry("financial_status", "Cash: 2,450 gp. Net goal: 10k gp.");
        plugin.setActiveTab("financial_status");

        expect(plugin.getConfig()).toEqual({
            enabled: true,
            activeTab: "financial_status",
            journal: {
                scripts: "Train shrimp fishing until inventory is full.",
                people: "",
                memories: "",
                financialStatus: "Cash: 2,450 gp. Net goal: 10k gp.",
            },
            scriptProposals: [],
            scriptActivity: [],
        });
        expect(savedConfig).toEqual(plugin.getConfig());
    });

    test("stores script proposals and recent activity in bounded journal state", () => {
        const plugin = new NotesPlugin({
            load: () => undefined,
            save: () => {},
        });

        expect(
            plugin.upsertScriptProposal({
                id: "agent-7:fish-loop",
                scriptId: "fish-loop",
                scriptText: "{\"schemaVersion\":1}",
                goal: "Fish until inventory is full.",
                generatedBy: "llm",
                sourceName: "Ralph",
                sourcePlayerId: 7,
                capturedAt: 123,
            }),
        ).toBe("added");
        expect(
            plugin.upsertScriptProposal({
                id: "agent-7:fish-loop",
                scriptId: "fish-loop",
                scriptText: "{\"schemaVersion\":1}",
                goal: "Fish until inventory is full.",
                generatedBy: "llm",
                sourceName: "Ralph",
                sourcePlayerId: 7,
                capturedAt: 123,
            }),
        ).toBe("unchanged");

        plugin.appendScriptActivity({
            id: "log-1",
            kind: "proposal",
            text: "Captured fish-loop from Ralph.",
            timestamp: 124,
        });
        plugin.dismissScriptProposal("agent-7:fish-loop");

        expect(plugin.getConfig().scriptProposals).toEqual([]);
        expect(plugin.getConfig().scriptActivity).toEqual([
            {
                id: "log-1",
                kind: "proposal",
                text: "Captured fish-loop from Ralph.",
                timestamp: 124,
            },
        ]);
    });
});

function pluginSnapshot() {
    return {
        enabled: true,
        activeTab: "scripts" as const,
        journal: {
            scripts: "",
            people: "",
            memories: "",
            financialStatus: "",
        },
        scriptProposals: [],
        scriptActivity: [],
    };
}
