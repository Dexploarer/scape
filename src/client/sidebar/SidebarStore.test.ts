import { SidebarStore } from "./SidebarStore";
import type { SidebarPersistence } from "./types";

type EntryData = {
    panelId: string;
    icon: string;
};

describe("SidebarStore", () => {
    test("register sorts by priority and keeps stable insertion order", () => {
        const store = new SidebarStore<EntryData>({ defaultOpen: true });

        store.register({ id: "b", title: "B", priority: 200, data: { panelId: "b", icon: "B" } });
        store.register({ id: "a", title: "A", priority: 100, data: { panelId: "a", icon: "A" } });
        store.register({
            id: "c",
            title: "C",
            priority: 200,
            data: { panelId: "c", icon: "C" },
        });

        expect(store.getState().entries.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    });

    test("toggleSelect opens selected entry and toggles closed on second click", () => {
        const store = new SidebarStore<EntryData>({ defaultOpen: false });
        store.register({
            id: "plugin_hub",
            title: "Plugin Hub",
            data: { panelId: "p", icon: "P" },
        });

        store.toggleSelect("plugin_hub");
        expect(store.getState().open).toBe(true);
        expect(store.getState().selectedId).toBe("plugin_hub");

        store.toggleSelect("plugin_hub");
        expect(store.getState().open).toBe(false);
        expect(store.getState().selectedId).toBeNull();
    });

    test("restores persisted state on construction", () => {
        const persistence: SidebarPersistence = {
            load: () => ({ open: false, selectedId: "notes" }),
            save: () => {},
        };
        const store = new SidebarStore<EntryData>({ persistence, defaultOpen: true });
        expect(store.getState().open).toBe(false);
        expect(store.getState().selectedId).toBe("notes");
    });

    test("auto-selects first entry when sidebar starts open with no selection", () => {
        const store = new SidebarStore<EntryData>({ defaultOpen: true });
        store.register({ id: "notes", title: "Notes", data: { panelId: "n", icon: "N" } });

        expect(store.getState().open).toBe(true);
        expect(store.getState().selectedId).toBe("notes");
    });

    test("keeps persisted selection while entries register in sequence", () => {
        const persistence: SidebarPersistence = {
            load: () => ({ open: true, selectedId: "notes" }),
            save: () => {},
        };
        const store = new SidebarStore<EntryData>({ persistence });
        store.register({
            id: "plugin_hub",
            title: "Plugin Hub",
            data: { panelId: "p", icon: "P" },
        });
        expect(store.getState().selectedId).toBe("notes");

        store.register({ id: "notes", title: "Notes", data: { panelId: "n", icon: "N" } });
        expect(store.getState().selectedId).toBe("notes");
        expect(store.getState().open).toBe(true);
    });

    test("opening resolves stale selection to first available entry", () => {
        const persistence: SidebarPersistence = {
            load: () => ({ open: false, selectedId: "missing" }),
            save: () => {},
        };
        const store = new SidebarStore<EntryData>({ persistence });
        store.register({ id: "notes", title: "Notes", data: { panelId: "n", icon: "N" } });

        store.setOpen(true);
        expect(store.getState().selectedId).toBe("notes");
    });

    test("persists state when open/selected changes", () => {
        const saved: Array<{ open: boolean; selectedId: string | null }> = [];
        const persistence: SidebarPersistence = {
            load: () => undefined,
            save: (state) => saved.push({ ...state }),
        };

        const store = new SidebarStore<EntryData>({ persistence, defaultOpen: true });
        store.register({ id: "notes", title: "Notes", data: { panelId: "n", icon: "N" } });
        store.select("notes");
        store.toggleSelect("notes");

        expect(saved.length).toBeGreaterThan(0);
        expect(saved[saved.length - 1]).toEqual({ open: false, selectedId: null });
    });
});
