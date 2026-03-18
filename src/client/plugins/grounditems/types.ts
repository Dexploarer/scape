import type { ClientGroundItemStack } from "../../data/ground/GroundItemStore";

export type GroundItemsPriceDisplayMode = "ha" | "ge" | "both" | "off";
export type GroundItemsValueCalculationMode = "ha" | "ge" | "highest";
export type GroundItemsOwnershipFilterMode = "all" | "takeable" | "drops";
export type GroundItemsDespawnTimerMode = "off" | "ticks" | "seconds";

export interface GroundItemsTimingContext {
    currentTick: number;
    tickPhase?: number;
    tickMs?: number;
}

export interface GroundItemsPluginConfig {
    enabled: boolean;
    highlightedItems: string;
    hiddenItems: string;
    showHighlightedOnly: boolean;
    rightClickHidden: boolean;
    recolorMenuHiddenItems: boolean;
    showMenuItemQuantities: boolean;
    dontHideUntradeables: boolean;
    hideUnderValue: number;
    priceDisplayMode: GroundItemsPriceDisplayMode;
    valueCalculationMode: GroundItemsValueCalculationMode;
    defaultColor: number;
    highlightedColor: number;
    hiddenColor: number;
    lowValueColor: number;
    lowValuePrice: number;
    mediumValueColor: number;
    mediumValuePrice: number;
    highValueColor: number;
    highValuePrice: number;
    insaneValueColor: number;
    insaneValuePrice: number;
    ownershipFilterMode: GroundItemsOwnershipFilterMode;
    despawnTimerMode: GroundItemsDespawnTimerMode;
}

export interface GroundItemsPluginState {
    config: GroundItemsPluginConfig;
    version: number;
}

export interface GroundItemsPluginPersistence {
    load(): Partial<GroundItemsPluginConfig> | undefined;
    save(config: GroundItemsPluginConfig): void;
}

export interface GroundItemEvaluation {
    stack: ClientGroundItemStack;
    label: string;
    baseLabel: string;
    timerLabel?: string;
    timerColor?: number;
    color: number;
    hidden: boolean;
    highlighted: boolean;
}
