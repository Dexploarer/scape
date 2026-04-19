export const NOTES_PLUGIN_JOURNAL_TAB_IDS = [
    "scripts",
    "people",
    "memories",
    "financial_status",
] as const;

export type NotesPluginJournalTabId = (typeof NOTES_PLUGIN_JOURNAL_TAB_IDS)[number];

export interface NotesPluginJournal {
    scripts: string;
    people: string;
    memories: string;
    financialStatus: string;
}

export type NotesPluginScriptActivityKind = "success" | "error" | "info" | "proposal";

export interface NotesPluginScriptProposal {
    id: string;
    scriptId: string;
    scriptText: string;
    name?: string;
    goal?: string;
    generatedBy?: string;
    sourceName?: string;
    sourcePlayerId?: number;
    capturedAt: number;
}

export interface NotesPluginScriptActivityEntry {
    id: string;
    kind: NotesPluginScriptActivityKind;
    text: string;
    timestamp: number;
}

export interface NotesPluginConfig {
    enabled: boolean;
    activeTab: NotesPluginJournalTabId;
    journal: NotesPluginJournal;
    scriptProposals: ReadonlyArray<NotesPluginScriptProposal>;
    scriptActivity: ReadonlyArray<NotesPluginScriptActivityEntry>;
}

export interface NotesPluginConfigInput {
    enabled?: boolean;
    activeTab?: NotesPluginJournalTabId;
    journal?: Partial<NotesPluginJournal>;
    scriptProposals?: ReadonlyArray<NotesPluginScriptProposal>;
    scriptActivity?: ReadonlyArray<NotesPluginScriptActivityEntry>;
    notes?: string;
}

export interface NotesPluginState {
    config: NotesPluginConfig;
    version: number;
}

export interface NotesPluginPersistence {
    load(): NotesPluginConfigInput | undefined;
    save(config: NotesPluginConfig): void;
}
