export interface TileMarkersPluginConfig {
    enabled: boolean;
    showDestinationTile: boolean;
    showCurrentTile: boolean;
    /** 0xRRGGBB */
    destinationTileColor: number;
    /** 0xRRGGBB */
    currentTileColor: number;
}

export interface TileMarkersPluginState {
    config: TileMarkersPluginConfig;
    version: number;
}

export interface TileMarkersPluginPersistence {
    load(): Partial<TileMarkersPluginConfig> | undefined;
    save(config: TileMarkersPluginConfig): void;
}
