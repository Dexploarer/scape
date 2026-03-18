import type { NotesPluginConfig, NotesPluginPersistence, NotesPluginState } from "./types";

type NotesPluginListener = () => void;

const DEFAULT_CONFIG: NotesPluginConfig = Object.freeze({
    enabled: true,
    notes: "",
});

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

    setConfig(nextConfig: Partial<NotesPluginConfig>): void {
        this.config = this.sanitizeConfig({
            ...this.config,
            ...nextConfig,
        });
        this.commit();
    }

    private sanitizeConfig(input: Partial<NotesPluginConfig> | undefined): NotesPluginConfig {
        const src = input ? input : {};
        return {
            enabled: src.enabled !== false,
            notes: typeof src.notes === "string" ? src.notes : DEFAULT_CONFIG.notes,
        };
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
