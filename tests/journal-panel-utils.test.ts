import { describe, expect, test } from "bun:test";

import {
    JOURNAL_SECTIONS,
    JOURNAL_RUNTIME_SCRIPT_TEMPLATES,
    JOURNAL_SCRIPT_TEMPLATES,
    appendJournalTemplate,
    buildJournalDirectiveContext,
    buildJournalFinancialSummary,
    buildJournalPeopleSummary,
    buildJournalScriptProposalFromMessage,
    buildJournalScriptTargets,
    findJournalSection,
    parseJournalScriptSpec,
} from "../src/client/sidebar/journalPanelUtils";

describe("journalPanelUtils", () => {
    test("appends script templates without clobbering existing text", () => {
        expect(appendJournalTemplate("", "Template A")).toBe("Template A");
        expect(appendJournalTemplate("Existing", "Template A")).toBe("Existing\n\nTemplate A");
    });

    test("builds financial summary from carried and banked items", () => {
        const summary = buildJournalFinancialSummary(createClientStub());

        expect(summary[0]).toEqual({
            title: "Liquidity",
            lines: [
                "Coins carried: 250",
                "Coins banked: 10,500",
                "Inventory slots used: 2/28",
                "Bank slots used: 2/1410",
            ],
        });
        expect(summary[1].lines).toEqual(["Coins x 250", "Lobster x 8"]);
        expect(summary[2].lines).toEqual(["Coins x 10,500", "Rune scimitar x 1"]);
    });

    test("builds people summary from nearby players and npcs", () => {
        const summary = buildJournalPeopleSummary(createClientStub());

        expect(summary[0]).toEqual({
            title: "Local Context",
            lines: [
                "Milady (lvl 87)",
                "Tile 3200, 3200, plane 0",
                "Nearby players / agents: 1",
                "Nearby NPCs: 2",
            ],
        });
        expect(summary[1].lines).toEqual(["Operator One (lvl 92, 3 tiles)"]);
        expect(summary[2].lines).toEqual([
            "Banker (lvl 9, 1 tiles)",
            "Goblin (lvl 2, 3 tiles)",
        ]);
    });

    test("builds script targets from nearby visible players", () => {
        expect(buildJournalScriptTargets(createClientStub())).toEqual([
            {
                playerId: 2,
                name: "Operator One",
                combatLevel: 92,
                distance: 3,
            },
        ]);
    });

    test("ships reusable script templates for the journal tab", () => {
        expect(JOURNAL_SCRIPT_TEMPLATES.map((template) => template.label)).toEqual([
            "Gather Loop",
            "Follow + React",
            "Training Routine",
        ]);
        expect(JOURNAL_SCRIPT_TEMPLATES[0]?.content).toContain("Wake on:");
        expect(JOURNAL_RUNTIME_SCRIPT_TEMPLATES.map((template) => template.label)).toEqual([
            "XP Watch JSON",
            "Walk + Wait JSON",
        ]);
        expect(JOURNAL_RUNTIME_SCRIPT_TEMPLATES[0]?.content).toContain('"schemaVersion": 1');
    });

    test("builds journal directive context from live summaries and stored notes", () => {
        const client = createClientStub();
        const context = buildJournalDirectiveContext({
            config: {
                enabled: true,
                activeTab: "people",
                journal: {
                    scripts: "Run the gather loop until inventory is full.",
                    people: "Operator One prefers short status pings.",
                    memories: "",
                    financialStatus: "Keep 2k gp liquid for food and runes.",
                },
            },
            activeTabOnly: true,
            peopleSummary: buildJournalPeopleSummary(client),
            financialSummary: buildJournalFinancialSummary(client),
        });

        expect(context).toContain("[Agent Journal / People]");
        expect(context).toContain("Local Context");
        expect(context).toContain("Notes");
        expect(context).toContain("Operator One prefers short status pings.");
        expect(context).not.toContain("[Agent Journal / Scripts]");
    });

    test("resolves journal sections by id", () => {
        expect(JOURNAL_SECTIONS.map((section) => section.label)).toEqual([
            "Scripts",
            "People",
            "Memories",
            "Financial Status",
        ]);
        expect(findJournalSection("financial_status").entryKey).toBe("financialStatus");
    });

    test("parses installable script specs from raw or fenced JSON", () => {
        const raw = parseJournalScriptSpec(JOURNAL_RUNTIME_SCRIPT_TEMPLATES[0]!.content);
        expect(raw).toMatchObject({
            ok: true,
            script: {
                schemaVersion: 1,
                scriptId: "xp-watch",
            },
        });

        const fenced = parseJournalScriptSpec([
            "Use this script for a short training loop.",
            "```json",
            JOURNAL_RUNTIME_SCRIPT_TEMPLATES[1]!.content,
            "```",
        ].join("\n"));
        expect(fenced).toMatchObject({
            ok: true,
            script: {
                scriptId: "walk-and-watch",
            },
        });

        expect(parseJournalScriptSpec("Goal: fish shrimp.")).toEqual({
            ok: false,
            error: "Add a raw JSON script spec or a fenced ```json``` block in the Scripts tab.",
        });
    });

    test("rejects script specs with broken internal step references", () => {
        expect(
            parseJournalScriptSpec(
                JSON.stringify({
                    schemaVersion: 1,
                    scriptId: "bad-script",
                    steps: [
                        {
                            id: "jump",
                            kind: "goto",
                            stepId: "missing",
                        },
                    ],
                }),
            ),
        ).toEqual({
            ok: false,
            error: "goto step jump references unknown step: missing",
        });
    });

    test("builds script proposals from chat messages with valid script json", () => {
        expect(
            buildJournalScriptProposalFromMessage({
                text: [
                    "Try this next.",
                    "```json",
                    JOURNAL_RUNTIME_SCRIPT_TEMPLATES[0]!.content,
                    "```",
                ].join("\n"),
                from: "Ralph",
                playerId: 7,
                timestamp: 321,
            }),
        ).toEqual({
            id: "player-7:xp-watch",
            scriptId: "xp-watch",
            scriptText: JOURNAL_RUNTIME_SCRIPT_TEMPLATES[0]!.content,
            name: "XP Watch",
            goal: "Wait for the next local XP gain and then finish cleanly.",
            generatedBy: "template",
            sourceName: "Ralph",
            sourcePlayerId: 7,
            capturedAt: 321,
        });

        expect(
            buildJournalScriptProposalFromMessage({
                text: "status only, no script here",
                from: "Ralph",
            }),
        ).toBeUndefined();
    });
});

function createClientStub() {
    const inventorySlots = [
        { slot: 0, itemId: 995, quantity: 250 },
        { slot: 1, itemId: 379, quantity: 8 },
    ];
    const bankSlots = [
        { slot: 0, itemId: 995, quantity: 10_500 },
        { slot: 1, itemId: 1333, quantity: 1 },
    ];

    return {
        controlledPlayerServerId: 1,
        inventory: createInventoryStub(28, inventorySlots),
        bankInventory: createInventoryStub(1410, bankSlots),
        objTypeLoader: {
            load: (id: number) =>
                ({
                    379: { name: "Lobster" },
                    995: { name: "Coins" },
                    1333: { name: "Rune scimitar" },
                })[id],
        },
        npcTypeLoader: {
            load: (id: number) =>
                ({
                    100: { name: "Banker", combatLevel: 9 },
                    101: { name: "Goblin", combatLevel: 2 },
                })[id],
        },
        playerEcs: {
            getIndexForServerId: (serverId: number) => (serverId === 1 ? 0 : serverId === 2 ? 1 : undefined),
            *getAllActiveIndices() {
                yield 0;
                yield 1;
            },
            getServerIdForIndex: (index: number) => (index === 0 ? 1 : index === 1 ? 2 : undefined),
            getName: (index: number) => (index === 0 ? "Milady" : index === 1 ? "Operator One" : undefined),
            getCombatLevel: (index: number) => (index === 0 ? 87 : index === 1 ? 92 : 0),
            getX: (index: number) => (index === 0 ? 3200 << 7 : 3203 << 7),
            getY: (index: number) => (index === 0 ? 3200 << 7 : 3198 << 7),
            getLevel: () => 0,
        },
        npcEcs: {
            *getAllActiveIds() {
                yield 1;
                yield 2;
            },
            isActive: () => true,
            isLinked: () => true,
            getServerId: (id: number) => id,
            getNpcTypeId: (id: number) => (id === 1 ? 100 : 101),
            getX: (id: number) => (id === 1 ? 3201 << 7 : 3197 << 7),
            getY: (id: number) => (id === 1 ? 3200 << 7 : 3203 << 7),
            getLevel: () => 0,
        },
    };
}

function createInventoryStub(
    capacity: number,
    occupied: Array<{ slot: number; itemId: number; quantity: number }>,
) {
    const slots = Array.from({ length: capacity }, (_, index) => ({
        slot: index,
        itemId: -1,
        quantity: 0,
    }));
    for (const entry of occupied) {
        slots[entry.slot] = { ...entry };
    }
    return {
        capacity,
        getSlots: () => slots.map((slot) => ({ ...slot })),
        count: (itemId: number) =>
            slots.reduce(
                (total, slot) => total + ((slot.itemId | 0) === (itemId | 0) ? slot.quantity | 0 : 0),
                0,
            ),
    };
}
