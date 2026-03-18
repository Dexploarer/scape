import type {
    InteractHighlightPluginConfig,
    InteractHighlightPluginPersistence,
    InteractHighlightPluginState,
} from "./types";

type InteractHighlightPluginListener = () => void;

const DEFAULT_CONFIG: InteractHighlightPluginConfig = Object.freeze({
    enabled: true,
    showHover: true,
    showInteract: true,
    hoverColor: 0x00ffff,
    interactColor: 0xff0000,
});

function sanitizeColor(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback & 0xffffff;
    return (Math.floor(numeric) & 0xffffff) >>> 0;
}

export class InteractHighlightPlugin {
    private readonly listeners: Set<InteractHighlightPluginListener> = new Set();
    private readonly persistence?: InteractHighlightPluginPersistence;

    private config: InteractHighlightPluginConfig;
    private state: InteractHighlightPluginState;
    private version = 0;

    constructor(persistence?: InteractHighlightPluginPersistence) {
        this.persistence = persistence;
        const loaded = persistence?.load();
        this.config = this.sanitizeConfig(loaded);
        this.state = {
            config: this.config,
            version: this.version,
        };
    }

    subscribe(listener: InteractHighlightPluginListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): InteractHighlightPluginState {
        return this.state;
    }

    getConfig(): InteractHighlightPluginConfig {
        return this.state.config;
    }

    setConfig(nextConfig: Partial<InteractHighlightPluginConfig>): void {
        this.config = this.sanitizeConfig({
            ...this.config,
            ...nextConfig,
        });
        this.commit();
    }

    private sanitizeConfig(
        input: Partial<InteractHighlightPluginConfig> | undefined,
    ): InteractHighlightPluginConfig {
        const src = input ? input : {};
        return {
            enabled: src.enabled !== false,
            showHover: src.showHover !== false,
            showInteract: src.showInteract !== false,
            hoverColor: sanitizeColor(src.hoverColor, DEFAULT_CONFIG.hoverColor),
            interactColor: sanitizeColor(src.interactColor, DEFAULT_CONFIG.interactColor),
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
                console.log("[interact-highlight-plugin] listener failed", err);
            }
        }
    }
}
