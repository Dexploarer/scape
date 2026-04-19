import {
    NOTES_PLUGIN_JOURNAL_TAB_IDS,
    type NotesPluginConfig,
    type NotesPluginConfigInput,
    type NotesPluginScriptActivityEntry,
    type NotesPluginScriptProposal,
    type NotesPluginJournal,
    type NotesPluginJournalTabId,
    type NotesPluginPersistence,
    type NotesPluginState,
} from "./types";

type NotesPluginListener = () => void;

const DEFAULT_CONFIG: NotesPluginConfig = Object.freeze({
    enabled: true,
    activeTab: "scripts",
    journal: Object.freeze({
        scripts: "",
        people: "",
        memories: "",
        financialStatus: "",
    }),
    scriptProposals: Object.freeze([]),
    scriptActivity: Object.freeze([]),
});

const SCRIPT_ACTIVITY_LIMIT = 12;
const SCRIPT_PROPOSAL_LIMIT = 8;

export class NotesPlugin {
    private readonly listeners: Set<NotesPluginListener> = new Set();
    private readonly persistence?: NotesPluginPersistence;

    private config: NotesPluginConfig;
    private state: NotesPluginState;
    private version = 0;

    constructor(persistence?: NotesPluginPersistence) {
        this.persistence = persistence;
        const loaded = persistence?.load();
        this.config = this.sanitizeConfig(loaded);
        this.state = {
            config: this.config,
            version: this.version,
        };
    }

    subscribe(listener: NotesPluginListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): NotesPluginState {
        return this.state;
    }

    getConfig(): NotesPluginConfig {
        return this.state.config;
    }

    setActiveTab(activeTab: NotesPluginJournalTabId): void {
        this.setConfig({ activeTab });
    }

    setJournalEntry(tab: NotesPluginJournalTabId, value: string): void {
        this.setConfig({
            journal: {
                ...this.config.journal,
                [this.toJournalKey(tab)]: value,
            },
        });
    }

    upsertScriptProposal(proposal: NotesPluginScriptProposal): "added" | "updated" | "unchanged" {
        const normalized = this.sanitizeScriptProposal(proposal);
        if (!normalized) {
            return "unchanged";
        }
        const existingIndex = this.config.scriptProposals.findIndex((entry) => entry.id === normalized.id);
        if (existingIndex >= 0) {
            const existing = this.config.scriptProposals[existingIndex]!;
            if (JSON.stringify(existing) === JSON.stringify(normalized)) {
                return "unchanged";
            }
            const next = this.config.scriptProposals.slice();
            next[existingIndex] = normalized;
            this.setConfig({ scriptProposals: next });
            return "updated";
        }
        this.setConfig({
            scriptProposals: [normalized, ...this.config.scriptProposals].slice(0, SCRIPT_PROPOSAL_LIMIT),
        });
        return "added";
    }

    dismissScriptProposal(proposalId: string): void {
        if (!proposalId) return;
        this.setConfig({
            scriptProposals: this.config.scriptProposals.filter((entry) => entry.id !== proposalId),
        });
    }

    appendScriptActivity(entry: NotesPluginScriptActivityEntry): void {
        const normalized = this.sanitizeScriptActivity(entry);
        if (!normalized) return;
        this.setConfig({
            scriptActivity: [normalized, ...this.config.scriptActivity].slice(0, SCRIPT_ACTIVITY_LIMIT),
        });
    }

    setConfig(nextConfig: NotesPluginConfigInput): void {
        this.config = this.sanitizeConfig({
            ...this.config,
            ...nextConfig,
            journal: nextConfig.journal
                ? {
                    ...this.config.journal,
                    ...nextConfig.journal,
                }
                : this.config.journal,
        });
        this.commit();
    }

    private sanitizeConfig(input: NotesPluginConfigInput | undefined): NotesPluginConfig {
        const src = input ? input : {};
        const activeTab = this.isJournalTabId(src.activeTab) ? src.activeTab : DEFAULT_CONFIG.activeTab;
        const legacyNotes = typeof src.notes === "string" ? src.notes : "";
        const journal = this.sanitizeJournal(src.journal, legacyNotes);
        return {
            enabled: src.enabled !== false,
            activeTab,
            journal,
            scriptProposals: this.sanitizeScriptProposals(src.scriptProposals),
            scriptActivity: this.sanitizeScriptActivityEntries(src.scriptActivity),
        };
    }

    private sanitizeJournal(input: unknown, legacyMemories: string): NotesPluginJournal {
        const src = input && typeof input === "object" ? input as Partial<NotesPluginJournal> : {};
        return {
            scripts: typeof src.scripts === "string" ? src.scripts : DEFAULT_CONFIG.journal.scripts,
            people: typeof src.people === "string" ? src.people : DEFAULT_CONFIG.journal.people,
            memories: typeof src.memories === "string"
                ? src.memories
                : legacyMemories || DEFAULT_CONFIG.journal.memories,
            financialStatus: typeof src.financialStatus === "string"
                ? src.financialStatus
                : DEFAULT_CONFIG.journal.financialStatus,
        };
    }

    private sanitizeScriptProposals(input: unknown): NotesPluginScriptProposal[] {
        if (!Array.isArray(input)) {
            return [];
        }
        return input
            .map((entry) => this.sanitizeScriptProposal(entry))
            .filter((entry): entry is NotesPluginScriptProposal => entry !== undefined)
            .slice(0, SCRIPT_PROPOSAL_LIMIT);
    }

    private sanitizeScriptProposal(input: unknown): NotesPluginScriptProposal | undefined {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return undefined;
        }
        const src = input as Partial<NotesPluginScriptProposal>;
        if (typeof src.id !== "string" || !src.id.trim()) {
            return undefined;
        }
        if (typeof src.scriptId !== "string" || !src.scriptId.trim()) {
            return undefined;
        }
        if (typeof src.scriptText !== "string" || !src.scriptText.trim()) {
            return undefined;
        }
        const capturedAt = typeof src.capturedAt === "number" && Number.isFinite(src.capturedAt)
            ? src.capturedAt
            : Date.now();
        return {
            id: src.id,
            scriptId: src.scriptId,
            scriptText: src.scriptText,
            name: typeof src.name === "string" && src.name.trim() ? src.name : undefined,
            goal: typeof src.goal === "string" && src.goal.trim() ? src.goal : undefined,
            generatedBy: typeof src.generatedBy === "string" && src.generatedBy.trim() ? src.generatedBy : undefined,
            sourceName: typeof src.sourceName === "string" && src.sourceName.trim() ? src.sourceName : undefined,
            sourcePlayerId: typeof src.sourcePlayerId === "number" && Number.isFinite(src.sourcePlayerId)
                ? src.sourcePlayerId
                : undefined,
            capturedAt,
        };
    }

    private sanitizeScriptActivityEntries(input: unknown): NotesPluginScriptActivityEntry[] {
        if (!Array.isArray(input)) {
            return [];
        }
        return input
            .map((entry) => this.sanitizeScriptActivity(entry))
            .filter((entry): entry is NotesPluginScriptActivityEntry => entry !== undefined)
            .slice(0, SCRIPT_ACTIVITY_LIMIT);
    }

    private sanitizeScriptActivity(input: unknown): NotesPluginScriptActivityEntry | undefined {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return undefined;
        }
        const src = input as Partial<NotesPluginScriptActivityEntry>;
        if (typeof src.id !== "string" || !src.id.trim()) {
            return undefined;
        }
        if (
            src.kind !== "success" &&
            src.kind !== "error" &&
            src.kind !== "info" &&
            src.kind !== "proposal"
        ) {
            return undefined;
        }
        if (typeof src.text !== "string" || !src.text.trim()) {
            return undefined;
        }
        return {
            id: src.id,
            kind: src.kind,
            text: src.text,
            timestamp: typeof src.timestamp === "number" && Number.isFinite(src.timestamp)
                ? src.timestamp
                : Date.now(),
        };
    }

    private isJournalTabId(value: unknown): value is NotesPluginJournalTabId {
        return typeof value === "string" &&
            NOTES_PLUGIN_JOURNAL_TAB_IDS.includes(value as NotesPluginJournalTabId);
    }

    private toJournalKey(tab: NotesPluginJournalTabId): keyof NotesPluginJournal {
        if (tab === "financial_status") {
            return "financialStatus";
        }
        return tab;
    }

    private commit(): void {
        this.version++;
        this.state = {
            config: this.config,
            version: this.version,
        };
        this.persistence?.save(this.config);
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (err) {
                console.log("[notes-plugin] listener failed", err);
            }
        }
    }
}
