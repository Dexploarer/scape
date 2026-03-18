import type {
    TileMarkersPluginConfig,
    TileMarkersPluginPersistence,
    TileMarkersPluginState,
} from "./types";

type TileMarkersPluginListener = () => void;

// OSRS cache default from struct highlight_destination_tile_colour_3650 param_1230.
const DEFAULT_DESTINATION_TILE_COLOR = 0xa9a753;
const LEGACY_DESTINATION_TILE_COLOR = 0x0000ff;

const DEFAULT_CONFIG: TileMarkersPluginConfig = Object.freeze({
    enabled: true,
    showDestinationTile: true,
    showCurrentTile: true,
    destinationTileColor: DEFAULT_DESTINATION_TILE_COLOR,
    currentTileColor: 0x808080,
});

function sanitizeColor(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback & 0xffffff;
    return (Math.floor(numeric) & 0xffffff) >>> 0;
}

export class TileMarkersPlugin {
    private readonly listeners: Set<TileMarkersPluginListener> = new Set();
    private readonly persistence?: TileMarkersPluginPersistence;

    private config: TileMarkersPluginConfig;
    private state: TileMarkersPluginState;
    private version = 0;

    constructor(persistence?: TileMarkersPluginPersistence) {
        this.persistence = persistence;
        const loaded = persistence?.load();
        this.config = this.sanitizeConfig(loaded);
        this.state = {
            config: this.config,
            version: this.version,
        };
    }

    subscribe(listener: TileMarkersPluginListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): TileMarkersPluginState {
        return this.state;
    }

    getConfig(): TileMarkersPluginConfig {
        return this.state.config;
    }

    setConfig(nextConfig: Partial<TileMarkersPluginConfig>): void {
        this.config = this.sanitizeConfig({
            ...this.config,
            ...nextConfig,
        });
        this.commit();
    }

    private sanitizeConfig(
        input: Partial<TileMarkersPluginConfig> | undefined,
    ): TileMarkersPluginConfig {
        const src = input ? input : {};
        // Migrate the previous hardcoded blue destination default to OSRS parity colour.
        const migrateLegacyDestinationColor =
            Number(src.destinationTileColor) === LEGACY_DESTINATION_TILE_COLOR &&
            (src.enabled === undefined || src.enabled === true) &&
            (src.showDestinationTile === undefined || src.showDestinationTile === true) &&
            (src.showCurrentTile === undefined || src.showCurrentTile === true) &&
            (src.currentTileColor === undefined || Number(src.currentTileColor) === 0x808080);

        return {
            enabled: src.enabled !== false,
            showDestinationTile: src.showDestinationTile !== false,
            showCurrentTile: src.showCurrentTile !== false,
            destinationTileColor: migrateLegacyDestinationColor
                ? DEFAULT_DESTINATION_TILE_COLOR
                : sanitizeColor(src.destinationTileColor, DEFAULT_CONFIG.destinationTileColor),
            currentTileColor: sanitizeColor(src.currentTileColor, DEFAULT_CONFIG.currentTileColor),
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
                console.log("[tile-markers-plugin] listener failed", err);
            }
        }
    }
}
