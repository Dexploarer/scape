import type { NotesPluginConfig, NotesPluginConfigInput, NotesPluginPersistence } from "./types";

export function createBrowserNotesPluginPersistence(
    storageKey: string,
    legacyNotesKey?: string,
): NotesPluginPersistence | undefined {
    if (typeof window === "undefined") return undefined;
    if (typeof window.localStorage === "undefined") return undefined;

    return {
        load: (): NotesPluginConfigInput | undefined => {
            try {
                const raw = window.localStorage.getItem(storageKey);
                if (raw) {
                    return JSON.parse(raw) as NotesPluginConfigInput;
                }

                if (typeof legacyNotesKey === "string" && legacyNotesKey.length > 0) {
                    const legacyNotes = window.localStorage.getItem(legacyNotesKey);
                    if (typeof legacyNotes === "string") {
                        return {
                            journal: {
                                memories: legacyNotes,
                            },
                        };
                    }
                }

                return undefined;
            } catch (error) {
                console.warn("[notes-plugin] failed to load persisted notes state", error);
                return undefined;
            }
        },
        save: (config: NotesPluginConfig): void => {
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(config));
            } catch (error) {
                console.warn("[notes-plugin] failed to persist notes state", error);
            }
        },
    };
}
