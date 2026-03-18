import type { TileMarkersPluginConfig, TileMarkersPluginPersistence } from "./types";

export function createBrowserTileMarkersPluginPersistence(
    storageKey: string,
): TileMarkersPluginPersistence | undefined {
    if (typeof window === "undefined") return undefined;
    if (typeof window.localStorage === "undefined") return undefined;

    return {
        load: (): Partial<TileMarkersPluginConfig> | undefined => {
            try {
                const raw = window.localStorage.getItem(storageKey);
                if (!raw) return undefined;
                return JSON.parse(raw) as Partial<TileMarkersPluginConfig>;
            } catch {
                return undefined;
            }
        },
        save: (config: TileMarkersPluginConfig): void => {
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(config));
            } catch {}
        },
    };
}
