import { SidebarStore } from "./SidebarStore";
import { type ClientSidebarEntryData, registerDefaultClientSidebarEntries } from "./entries";
import type { SidebarPersistence } from "./types";

describe("registerDefaultClientSidebarEntries", () => {
    test("remaps stale persisted selection to first default entry when sidebar is open", () => {
        const persistence: SidebarPersistence = {
            load: () => ({ open: true, selectedId: "missing_plugin" }),
            save: () => {},
        };
        const store = new SidebarStore<ClientSidebarEntryData>({ persistence });

        registerDefaultClientSidebarEntries(store);

        expect(store.getState().open).toBe(true);
        expect(store.getState().selectedId).toBe("plugin_hub");
        expect(store.getState().entries.map((entry) => entry.id)).toEqual([
            "plugin_hub",
            "ground_items",
            "tile_markers",
            "interact_highlight",
            "notes",
        ]);
    });

    test("clears stale persisted selection when sidebar is closed", () => {
        const persistence: SidebarPersistence = {
            load: () => ({ open: false, selectedId: "missing_plugin" }),
            save: () => {},
        };
        const store = new SidebarStore<ClientSidebarEntryData>({ persistence });

        registerDefaultClientSidebarEntries(store);

        expect(store.getState().open).toBe(false);
        expect(store.getState().selectedId).toBeNull();
        expect(store.getState().entries.map((entry) => entry.id)).toEqual([
            "plugin_hub",
            "ground_items",
            "tile_markers",
            "interact_highlight",
            "notes",
        ]);
    });

    test("unregisters disabled plugins and keeps plugin hub visible", () => {
        const store = new SidebarStore<ClientSidebarEntryData>({ defaultOpen: true });

        registerDefaultClientSidebarEntries(store, {
            groundItemsEnabled: false,
            interactHighlightEnabled: false,
            notesEnabled: false,
            tileMarkersEnabled: false,
        });

        expect(store.getState().entries.map((entry) => entry.id)).toEqual(["plugin_hub"]);
        expect(store.getState().selectedId).toBe("plugin_hub");
        expect(store.getState().open).toBe(true);
    });
});
