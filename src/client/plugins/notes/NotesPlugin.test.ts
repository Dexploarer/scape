import { NotesPlugin } from "./NotesPlugin";
import type { NotesPluginConfig, NotesPluginPersistence } from "./types";

describe("NotesPlugin", () => {
    test("defaults to enabled with empty notes", () => {
        const plugin = new NotesPlugin();

        expect(plugin.getState().config).toEqual({
            enabled: true,
            notes: "",
        });
    });

    test("loads persisted notes and enabled state", () => {
        const persistence: NotesPluginPersistence = {
            load: () => ({
                enabled: false,
                notes: "todo",
            }),
            save: () => {},
        };
        const plugin = new NotesPlugin(persistence);

        expect(plugin.getState().config).toEqual({
            enabled: false,
            notes: "todo",
        });
    });

    test("persists config updates", () => {
        let saved: NotesPluginConfig | undefined;
        const persistence: NotesPluginPersistence = {
            load: () => undefined,
            save: (config) => {
                saved = config;
            },
        };
        const plugin = new NotesPlugin(persistence);

        plugin.setConfig({ notes: "abc", enabled: false });

        expect(saved).toEqual({
            enabled: false,
            notes: "abc",
        });
    });
});
