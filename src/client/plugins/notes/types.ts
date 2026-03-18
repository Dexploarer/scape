export interface NotesPluginConfig {
    enabled: boolean;
    notes: string;
}

export interface NotesPluginState {
    config: NotesPluginConfig;
    version: number;
}

export interface NotesPluginPersistence {
    load(): Partial<NotesPluginConfig> | undefined;
    save(config: NotesPluginConfig): void;
}
