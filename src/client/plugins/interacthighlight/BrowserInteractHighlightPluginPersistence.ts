import type { InteractHighlightPluginConfig, InteractHighlightPluginPersistence } from "./types";

export function createBrowserInteractHighlightPluginPersistence(
    storageKey: string,
): InteractHighlightPluginPersistence | undefined {
    if (typeof window === "undefined") return undefined;
    if (typeof window.localStorage === "undefined") return undefined;

    return {
        load: (): Partial<InteractHighlightPluginConfig> | undefined => {
            try {
                const raw = window.localStorage.getItem(storageKey);
                if (!raw) return undefined;
                return JSON.parse(raw) as Partial<InteractHighlightPluginConfig>;
            } catch {
                return undefined;
            }
        },
        save: (config: InteractHighlightPluginConfig): void => {
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(config));
            } catch {}
        },
    };
}
