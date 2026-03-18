import type { GroundItemsPluginConfig, GroundItemsPluginPersistence } from "./types";

export function createBrowserGroundItemsPluginPersistence(
    storageKey: string,
): GroundItemsPluginPersistence | undefined {
    if (typeof window === "undefined") return undefined;
    if (typeof window.localStorage === "undefined") return undefined;

    return {
        load: (): Partial<GroundItemsPluginConfig> | undefined => {
            try {
                const raw = window.localStorage.getItem(storageKey);
                if (!raw) return undefined;
                return JSON.parse(raw) as Partial<GroundItemsPluginConfig>;
            } catch {
                return undefined;
            }
        },
        save: (config: GroundItemsPluginConfig): void => {
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(config));
            } catch {}
        },
    };
}
