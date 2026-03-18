export interface InteractHighlightPluginConfig {
    enabled: boolean;
    showHover: boolean;
    showInteract: boolean;
    /** 0xRRGGBB */
    hoverColor: number;
    /** 0xRRGGBB */
    interactColor: number;
}

export interface InteractHighlightPluginState {
    config: InteractHighlightPluginConfig;
    version: number;
}

export interface InteractHighlightPluginPersistence {
    load(): Partial<InteractHighlightPluginConfig> | undefined;
    save(config: InteractHighlightPluginConfig): void;
}
