import type { InventorySlot } from "../../rs/inventory/Inventory";
import {
    type AgentScriptCommand,
    type AgentScriptSpec,
    type AgentScriptStep,
    validateAgentScriptSpec,
} from "../../shared/agent/AgentScript";
import type {
    NotesPluginConfig,
    NotesPluginJournal,
    NotesPluginJournalTabId,
    NotesPluginScriptProposal,
} from "../plugins/notes/types";

const COINS_ITEM_ID = 995;
const JOURNAL_NEARBY_LIMIT = 6;

export type JournalSummaryGroup = {
    title: string;
    lines: string[];
};

export type JournalScriptTarget = {
    playerId: number;
    name: string;
    combatLevel: number;
    distance: number;
};

export type JournalScriptTemplate = {
    id: string;
    label: string;
    content: string;
};

export type JournalAgentScriptCommand = AgentScriptCommand;
export type JournalAgentScriptStep = AgentScriptStep;
export type JournalAgentScriptSpec = AgentScriptSpec;

export type JournalScriptParseResult =
    | { ok: true; script: JournalAgentScriptSpec }
    | { ok: false; error: string };

export type JournalScriptProposalMessage = {
    text?: string;
    from?: string;
    playerId?: number;
    timestamp?: number;
};

export type JournalSectionDescriptor = {
    id: NotesPluginJournalTabId;
    entryKey: keyof NotesPluginJournal;
    label: string;
    description: string;
    placeholder: string;
};

type JournalInventoryLike = {
    capacity: number;
    getSlots(): InventorySlot[];
    count(itemId: number): number;
};

type JournalPlayerEcsLike = {
    getIndexForServerId(serverId: number): number | undefined;
    getAllActiveIndices(): IterableIterator<number>;
    getServerIdForIndex(index: number): number | undefined;
    getName(index: number): string | undefined;
    getCombatLevel(index: number): number;
    getX(index: number): number;
    getY(index: number): number;
    getLevel(index: number): number;
};

type JournalNpcEcsLike = {
    getAllActiveIds(): Iterable<number>;
    isActive(id: number): boolean;
    isLinked(id: number): boolean;
    getServerId(id: number): number;
    getNpcTypeId(id: number): number;
    getX(id: number): number;
    getY(id: number): number;
    getLevel(id: number): number;
};

type JournalNamedLoaderLike = {
    load?(id: number): { name?: string; combatLevel?: number } | undefined;
};

export type JournalOsrsClientLike = {
    controlledPlayerServerId: number;
    playerEcs: JournalPlayerEcsLike;
    npcEcs: JournalNpcEcsLike;
    inventory: JournalInventoryLike;
    bankInventory: JournalInventoryLike;
    objTypeLoader?: JournalNamedLoaderLike;
    npcTypeLoader?: JournalNamedLoaderLike;
};

export const JOURNAL_SCRIPT_TEMPLATES: ReadonlyArray<JournalScriptTemplate> = Object.freeze([
    {
        id: "gather-loop",
        label: "Gather Loop",
        content: [
            "Goal: Gather one resource until inventory is full.",
            "Wake on: ITEM_GAINED, INVENTORY_FULL, UNDER_ATTACK, TARGET_LOST.",
            "Loop:",
            "1. Move to the nearest safe resource node.",
            "2. Interact once.",
            "3. Wait for item gain or interruption.",
            "Interrupts:",
            "- UNDER_ATTACK -> retreat, eat if needed, then resume.",
            "- INVENTORY_FULL -> branch to banking script or request operator decision.",
        ].join("\n"),
    },
    {
        id: "follow-react",
        label: "Follow + React",
        content: [
            "Goal: Stay near a designated human/operator and react to nearby threats.",
            "Wake on: OPERATOR_COMMAND, TARGET_ATTACKED, MOVEMENT_COMPLETE, HP_LOW.",
            "Loop:",
            "1. Follow the operator until within safe distance.",
            "2. If operator enters combat and threat is reachable, assist once.",
            "3. If target is lost, reacquire operator before taking any new action.",
            "Interrupts:",
            "- HP_LOW -> disengage and retreat to safe state.",
            "- STOP / HOLD -> freeze in place and wait.",
        ].join("\n"),
    },
    {
        id: "training-routine",
        label: "Training Routine",
        content: [
            "Goal: Repeat one skilling or combat training routine for a bounded session.",
            "Session budget: 20 minutes or 3 inventory cycles.",
            "Progress markers: XP gain, level up, inventory turnover, bank deposit.",
            "Recovery ladder:",
            "1. Retry interaction once.",
            "2. Pick an alternate nearby affordance.",
            "3. Reset pathing/targeting.",
            "4. Emit stuck marker and request replan.",
        ].join("\n"),
    },
]);

const JOURNAL_RUNTIME_SCRIPT_SPECS: ReadonlyArray<{
    id: string;
    label: string;
    spec: JournalAgentScriptSpec;
}> = Object.freeze([
    {
        id: "xp-watch",
        label: "XP Watch JSON",
        spec: {
            schemaVersion: 1,
            scriptId: "xp-watch",
            name: "XP Watch",
            goal: "Wait for the next local XP gain and then finish cleanly.",
            generatedBy: "template",
            steps: [
                {
                    id: "wait_for_xp",
                    kind: "wait",
                    events: ["skill:xpGain"],
                    timeoutMs: 30000,
                    timeoutStepId: "timeout",
                    nextStepId: "done",
                },
                {
                    id: "done",
                    kind: "complete",
                    outcome: "success",
                    message: "Observed XP gain.",
                },
                {
                    id: "timeout",
                    kind: "complete",
                    outcome: "failed",
                    message: "No XP gain arrived before timeout.",
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "Stopped by operator.",
                },
            },
        } as JournalAgentScriptSpec,
    },
    {
        id: "walk-and-watch",
        label: "Walk + Wait JSON",
        spec: {
            schemaVersion: 1,
            scriptId: "walk-and-watch",
            name: "Walk + Wait",
            goal: "Walk to a target tile, then wait for a notable local event.",
            generatedBy: "template",
            steps: [
                {
                    id: "move",
                    kind: "action",
                    command: {
                        action: "walkTo",
                        params: {
                            x: 3200,
                            z: 3200,
                            run: true,
                        },
                    },
                    nextStepId: "wait_for_signal",
                },
                {
                    id: "wait_for_signal",
                    kind: "wait",
                    events: ["npc:death", "item:craft", "skill:levelUp"],
                    timeoutMs: 20000,
                    timeoutStepId: "timed_out",
                    nextStepId: "done",
                },
                {
                    id: "done",
                    kind: "complete",
                    outcome: "success",
                    message: "Observed a wake event after moving.",
                },
                {
                    id: "timed_out",
                    kind: "complete",
                    outcome: "failed",
                    message: "Timed out waiting for a wake event.",
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "Stopped by operator.",
                },
                INTERRUPT_RETREAT: {
                    policy: "complete",
                    message: "Retreated after operator interrupt.",
                },
            },
        } as JournalAgentScriptSpec,
    },
]);

export const JOURNAL_RUNTIME_SCRIPT_TEMPLATES: ReadonlyArray<JournalScriptTemplate> = Object.freeze(
    JOURNAL_RUNTIME_SCRIPT_SPECS.map((entry) => ({
        id: entry.id,
        label: entry.label,
        content: JSON.stringify(entry.spec, null, 2),
    })),
);

export const JOURNAL_SECTIONS: ReadonlyArray<JournalSectionDescriptor> = Object.freeze([
    {
        id: "scripts",
        entryKey: "scripts",
        label: "Scripts",
        description: "Track long-running routines, training loops, and interrupt cues the agent can pick up later.",
        placeholder: "Document script goals, stop words, interrupts, checkpoints, and when the agent should hand control back.",
    },
    {
        id: "people",
        entryKey: "people",
        label: "People",
        description: "Log humans, other agents, and NPCs that matter to this world branch.",
        placeholder: "Record who matters, what they want, relationship changes, and any promises, threats, or alliances.",
    },
    {
        id: "memories",
        entryKey: "memories",
        label: "Memories",
        description: "Capture durable facts, routes, grudges, task context, and world knowledge worth recalling.",
        placeholder: "Write the facts and local context the agent should remember the next time it wakes up here.",
    },
    {
        id: "financial_status",
        entryKey: "financialStatus",
        label: "Financial Status",
        description: "Track cash, bank goals, current inventory value, debts, and the next money milestone.",
        placeholder: "Note coins on hand, banked value, supplies burn, target purchases, and any risk limits.",
    },
]);

export const DEFAULT_JOURNAL_SECTION = JOURNAL_SECTIONS[0]!;

export function appendJournalTemplate(existing: string, template: string): string {
    const normalizedExisting = String(existing ?? "").trim();
    const normalizedTemplate = String(template ?? "").trim();
    if (!normalizedExisting) {
        return normalizedTemplate;
    }
    if (!normalizedTemplate) {
        return normalizedExisting;
    }
    return `${normalizedExisting}\n\n${normalizedTemplate}`;
}

export function findJournalSection(tabId: NotesPluginJournalTabId): JournalSectionDescriptor {
    return JOURNAL_SECTIONS.find((section) => section.id === tabId) ?? DEFAULT_JOURNAL_SECTION;
}

export function parseJournalScriptSpec(input: string): JournalScriptParseResult {
    const candidate = extractJournalScriptJsonCandidate(input);
    if (!candidate) {
        return {
            ok: false,
            error: "Add a raw JSON script spec or a fenced ```json``` block in the Scripts tab.",
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(candidate);
    } catch (error) {
        return {
            ok: false,
            error: `Script JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
        };
    }

    const root =
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        parsed !== null &&
        "script" in parsed &&
        typeof (parsed as { script?: unknown }).script === "object" &&
        (parsed as { script?: unknown }).script !== null
            ? (parsed as { script: unknown }).script
            : parsed;

    if (!root || typeof root !== "object" || Array.isArray(root)) {
        return { ok: false, error: "Script JSON must decode to an object." };
    }

    const spec = root as JournalAgentScriptSpec;
    const validation = validateAgentScriptSpec(spec);
    if (!validation.ok) {
        return { ok: false, error: validation.error };
    }

    return { ok: true, script: spec };
}

export function formatJournalSummaryGroups(groups: ReadonlyArray<JournalSummaryGroup>): string {
    return groups
        .map((group) => {
            const lines = group.lines.map((line) => `- ${line}`).join("\n");
            return `${group.title}\n${lines}`;
        })
        .join("\n\n")
        .trim();
}

export function buildJournalDirectiveContext(params: {
    config: NotesPluginConfig;
    activeTabOnly?: boolean;
    peopleSummary?: ReadonlyArray<JournalSummaryGroup>;
    financialSummary?: ReadonlyArray<JournalSummaryGroup>;
}): string {
    const sections = params.activeTabOnly
        ? [findJournalSection(params.config.activeTab)]
        : JOURNAL_SECTIONS;
    const blocks: string[] = [];

    for (const section of sections) {
        const content = params.config.journal[section.entryKey].trim();
        const extras =
            section.id === "people"
                ? formatJournalSummaryGroups(params.peopleSummary ?? [])
                : section.id === "financial_status"
                ? formatJournalSummaryGroups(params.financialSummary ?? [])
                : "";
        const merged = [extras, content].filter((value) => value && value.trim().length > 0).join("\n\nNotes\n");
        if (!merged) {
            continue;
        }
        blocks.push(`[Agent Journal / ${section.label}]\n${merged}`);
    }

    return blocks.join("\n\n").trim();
}

export function buildJournalFinancialSummary(osrsClient: JournalOsrsClientLike): JournalSummaryGroup[] {
    const inventorySlots = getOccupiedSlots(osrsClient.inventory);
    const bankSlots = getOccupiedSlots(osrsClient.bankInventory);
    const carriedCoins = osrsClient.inventory.count(COINS_ITEM_ID);
    const bankedCoins = osrsClient.bankInventory.count(COINS_ITEM_ID);

    return [
        {
            title: "Liquidity",
            lines: [
                `Coins carried: ${formatQuantity(carriedCoins)}`,
                `Coins banked: ${formatQuantity(bankedCoins)}`,
                `Inventory slots used: ${inventorySlots.length}/${osrsClient.inventory.capacity}`,
                `Bank slots used: ${bankSlots.length}/${osrsClient.bankInventory.capacity}`,
            ],
        },
        {
            title: "Backpack Snapshot",
            lines: summarizeStacks(inventorySlots, osrsClient.objTypeLoader, 4),
        },
        {
            title: "Bank Snapshot",
            lines: summarizeStacks(bankSlots, osrsClient.objTypeLoader, 4),
        },
    ];
}

export function buildJournalPeopleSummary(osrsClient: JournalOsrsClientLike): JournalSummaryGroup[] {
    const localIndex = osrsClient.playerEcs.getIndexForServerId(osrsClient.controlledPlayerServerId | 0);
    if (localIndex === undefined) {
        return [
            {
                title: "Local Context",
                lines: ["Local player context is not available yet."],
            },
        ];
    }

    const localTileX = osrsClient.playerEcs.getX(localIndex) >> 7;
    const localTileY = osrsClient.playerEcs.getY(localIndex) >> 7;
    const localPlane = osrsClient.playerEcs.getLevel(localIndex) | 0;
    const localName = osrsClient.playerEcs.getName(localIndex) ?? "Unknown";
    const localCombat = osrsClient.playerEcs.getCombatLevel(localIndex) | 0;

    const nearbyPlayers = Array.from(osrsClient.playerEcs.getAllActiveIndices())
        .filter((index) => index !== localIndex)
        .map((index) => {
            const plane = osrsClient.playerEcs.getLevel(index) | 0;
            const tileX = osrsClient.playerEcs.getX(index) >> 7;
            const tileY = osrsClient.playerEcs.getY(index) >> 7;
            return {
                name: osrsClient.playerEcs.getName(index) ?? `Player ${osrsClient.playerEcs.getServerIdForIndex(index) ?? index}`,
                combatLevel: osrsClient.playerEcs.getCombatLevel(index) | 0,
                distance: chebyshevDistance(localTileX, localTileY, tileX, tileY),
                samePlane: plane === localPlane,
            };
        })
        .filter((entry) => entry.samePlane)
        .sort((lhs, rhs) => lhs.distance - rhs.distance || lhs.name.localeCompare(rhs.name))
        .slice(0, JOURNAL_NEARBY_LIMIT)
        .map((entry) => `${entry.name} (lvl ${entry.combatLevel}, ${entry.distance} tiles)`);

    const nearbyNpcs = Array.from(osrsClient.npcEcs.getAllActiveIds())
        .filter((id) => osrsClient.npcEcs.isActive(id) && osrsClient.npcEcs.isLinked(id))
        .map((id) => {
            const plane = osrsClient.npcEcs.getLevel(id) | 0;
            const tileX = osrsClient.npcEcs.getX(id) >> 7;
            const tileY = osrsClient.npcEcs.getY(id) >> 7;
            const npcTypeId = osrsClient.npcEcs.getNpcTypeId(id) | 0;
            const npcType = osrsClient.npcTypeLoader?.load?.(npcTypeId);
            return {
                name: npcType?.name ?? `NPC ${osrsClient.npcEcs.getServerId(id)}`,
                combatLevel: typeof npcType?.combatLevel === "number" ? npcType.combatLevel | 0 : 0,
                distance: chebyshevDistance(localTileX, localTileY, tileX, tileY),
                samePlane: plane === localPlane,
            };
        })
        .filter((entry) => entry.samePlane)
        .sort((lhs, rhs) => lhs.distance - rhs.distance || lhs.name.localeCompare(rhs.name))
        .slice(0, JOURNAL_NEARBY_LIMIT)
        .map((entry) =>
            entry.combatLevel > 0
                ? `${entry.name} (lvl ${entry.combatLevel}, ${entry.distance} tiles)`
                : `${entry.name} (${entry.distance} tiles)`
        );

    return [
        {
            title: "Local Context",
            lines: [
                `${localName} (lvl ${localCombat})`,
                `Tile ${localTileX}, ${localTileY}, plane ${localPlane}`,
                `Nearby players / agents: ${nearbyPlayers.length}`,
                `Nearby NPCs: ${nearbyNpcs.length}`,
            ],
        },
        {
            title: "Players / Agents Nearby",
            lines: nearbyPlayers.length > 0 ? nearbyPlayers : ["No nearby players tracked right now."],
        },
        {
            title: "NPCs Nearby",
            lines: nearbyNpcs.length > 0 ? nearbyNpcs : ["No nearby NPCs tracked right now."],
        },
    ];
}

export function buildJournalScriptTargets(
    osrsClient: JournalOsrsClientLike,
): JournalScriptTarget[] {
    const localIndex = osrsClient.playerEcs.getIndexForServerId(osrsClient.controlledPlayerServerId | 0);
    if (localIndex === undefined) {
        return [];
    }

    const localTileX = osrsClient.playerEcs.getX(localIndex) >> 7;
    const localTileY = osrsClient.playerEcs.getY(localIndex) >> 7;
    const localPlane = osrsClient.playerEcs.getLevel(localIndex) | 0;

    return Array.from(osrsClient.playerEcs.getAllActiveIndices())
        .filter((index) => index !== localIndex)
        .map((index) => {
            const playerId = osrsClient.playerEcs.getServerIdForIndex(index);
            const plane = osrsClient.playerEcs.getLevel(index) | 0;
            const tileX = osrsClient.playerEcs.getX(index) >> 7;
            const tileY = osrsClient.playerEcs.getY(index) >> 7;
            return {
                playerId,
                name:
                    osrsClient.playerEcs.getName(index) ??
                    `Player ${playerId ?? index}`,
                combatLevel: osrsClient.playerEcs.getCombatLevel(index) | 0,
                distance: chebyshevDistance(localTileX, localTileY, tileX, tileY),
                samePlane: plane === localPlane,
            };
        })
        .filter((entry): entry is JournalScriptTarget & { samePlane: boolean } =>
            typeof entry.playerId === "number" && entry.samePlane,
        )
        .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
        .slice(0, JOURNAL_NEARBY_LIMIT)
        .map(({ samePlane: _samePlane, ...entry }) => entry);
}

export function buildJournalScriptProposalFromMessage(
    message: JournalScriptProposalMessage,
): NotesPluginScriptProposal | undefined {
    const parsed = parseJournalScriptSpec(String(message.text ?? ""));
    if (!parsed.ok) {
        return undefined;
    }

    const spec = parsed.script;
    const sourceName = typeof message.from === "string" && message.from.trim() ? message.from.trim() : undefined;
    const sourcePlayerId =
        typeof message.playerId === "number" && Number.isFinite(message.playerId)
            ? message.playerId
            : undefined;
    const capturedAt =
        typeof message.timestamp === "number" && Number.isFinite(message.timestamp)
            ? message.timestamp
            : Date.now();
    const sourceKey = sourcePlayerId !== undefined ? `player-${sourcePlayerId}` : sourceName ? slugifyJournalName(sourceName) : "unknown";

    return {
        id: `${sourceKey}:${spec.scriptId}`,
        scriptId: spec.scriptId,
        scriptText: JSON.stringify(spec, null, 2),
        name: typeof spec.name === "string" && spec.name.trim() ? spec.name.trim() : undefined,
        goal: typeof spec.goal === "string" && spec.goal.trim() ? spec.goal.trim() : undefined,
        generatedBy:
            typeof spec.generatedBy === "string" && spec.generatedBy.trim()
                ? spec.generatedBy.trim()
                : undefined,
        sourceName,
        sourcePlayerId,
        capturedAt,
    };
}

function extractJournalScriptJsonCandidate(input: string): string | undefined {
    const text = String(input ?? "").trim();
    if (!text) return undefined;
    const fencedMatch = /```json\s*([\s\S]*?)```/i.exec(text) ?? /```\s*([\s\S]*?)```/i.exec(text);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }
    if (text.startsWith("{") && text.endsWith("}")) {
        return text;
    }
    return undefined;
}

function getOccupiedSlots(inventory: JournalInventoryLike): InventorySlot[] {
    return inventory.getSlots().filter((slot) => (slot.itemId | 0) > 0);
}

function summarizeStacks(
    slots: InventorySlot[],
    loader: JournalNamedLoaderLike | undefined,
    limit: number,
): string[] {
    if (slots.length === 0) {
        return ["No items tracked yet."];
    }

    const totals = new Map<number, number>();
    for (const slot of slots) {
        totals.set(slot.itemId | 0, (totals.get(slot.itemId | 0) ?? 0) + (slot.quantity | 0));
    }

    return Array.from(totals.entries())
        .sort((lhs, rhs) => rhs[1] - lhs[1] || lhs[0] - rhs[0])
        .slice(0, Math.max(1, limit | 0))
        .map(([itemId, quantity]) => `${resolveName(loader, itemId)} x ${formatQuantity(quantity)}`);
}

function resolveName(loader: JournalNamedLoaderLike | undefined, id: number): string {
    const name = loader?.load?.(id)?.name;
    return typeof name === "string" && name.trim().length > 0 ? name : `Item ${id | 0}`;
}

function formatQuantity(value: number): string {
    return new Intl.NumberFormat("en-US").format(Math.max(0, value | 0));
}

function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs((ax | 0) - (bx | 0)), Math.abs((ay | 0) - (by | 0)));
}

function slugifyJournalName(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "unknown";
}
