import type { NotesPluginConfig, NotesPluginPersistence } from "./types";

export function createBrowserNotesPluginPersistence(
    storageKey: string,
    legacyNotesKey?: string,
): NotesPluginPersistence | undefined {
    if (typeof window === "undefined") return undefined;
    if (typeof window.localStorage === "undefined") return undefined;

    return {
        load: (): Partial<NotesPluginConfig> | undefined => {
            try {
                const raw = window.localStorage.getItem(storageKey);
                if (raw) {
                    return JSON.parse(raw) as Partial<NotesPluginConfig>;
                }

                if (typeof legacyNotesKey === "string" && legacyNotesKey.length > 0) {
                    const legacyNotes = window.localStorage.getItem(legacyNotesKey);
                    if (typeof legacyNotes === "string") {
                        return {
                            notes: legacyNotes,
                        };
                    }
                }

                return undefined;
            } catch {
                return undefined;
            }
        },
        save: (config: NotesPluginConfig): void => {
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(config));
            } catch {}
        },
    };
}
