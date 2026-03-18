import {
    type SidebarEntry,
    type SidebarEntryDefinition,
    type SidebarEntryId,
    type SidebarPersistedState,
    type SidebarPersistence,
    type SidebarState,
} from "./types";

type SidebarListener = () => void;

type InternalSidebarEntry<TData> = SidebarEntry<TData> & {
    order: number;
};

export interface SidebarStoreOptions {
    defaultOpen?: boolean;
    defaultSelectedId?: SidebarEntryId | null;
    persistence?: SidebarPersistence;
}

export class SidebarStore<TData = unknown> {
    private readonly listeners: Set<SidebarListener> = new Set();
    private readonly entries: Map<SidebarEntryId, InternalSidebarEntry<TData>> = new Map();
    private readonly persistence?: SidebarPersistence;

    private orderCounter = 0;
    private open: boolean;
    private selectedId: SidebarEntryId | null;
    private state: SidebarState<TData>;
    private version = 0;

    constructor(options: SidebarStoreOptions = {}) {
        this.persistence = options.persistence;

        const persisted = this.persistence?.load();
        const persistedOpen = persisted?.open;
        const defaultOpen = options.defaultOpen;
        this.open =
            typeof persistedOpen === "boolean"
                ? persistedOpen
                : typeof defaultOpen === "boolean"
                ? defaultOpen
                : true;
        this.selectedId =
            persisted?.selectedId !== undefined
                ? persisted.selectedId
                : options.defaultSelectedId !== undefined
                ? options.defaultSelectedId
                : null;
        this.state = {
            open: this.open,
            selectedId: this.selectedId,
            entries: [],
            version: this.version,
        };
    }

    subscribe(listener: SidebarListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): SidebarState<TData> {
        return this.state;
    }

    register(definition: SidebarEntryDefinition<TData>): () => void {
        const existing = this.entries.get(definition.id);
        const order = existing ? existing.order : this.orderCounter++;
        this.entries.set(definition.id, {
            id: definition.id,
            title: definition.title,
            tooltip: definition.tooltip,
            priority: typeof definition.priority === "number" ? definition.priority : 1000,
            data: definition.data,
            order,
        });
        this.rebuildState();
        return () => {
            this.unregister(definition.id);
        };
    }

    unregister(entryId: SidebarEntryId): void {
        if (!this.entries.delete(entryId)) {
            return;
        }

        if (this.selectedId === entryId) {
            this.selectedId = null;
            this.open = false;
        }

        this.rebuildState();
    }

    setOpen(open: boolean): void {
        const nextOpen = open === true;
        if (this.open === nextOpen) {
            return;
        }

        this.open = nextOpen;
        if (this.open && (this.selectedId === null || !this.entries.has(this.selectedId))) {
            const firstEntry = this.getSortedEntries()[0];
            this.selectedId = firstEntry ? firstEntry.id : null;
        }
        this.rebuildState();
    }

    toggleOpen(): void {
        this.setOpen(!this.open);
    }

    select(entryId: SidebarEntryId | null): void {
        if (entryId === null) {
            if (this.selectedId === null && this.open === false) {
                return;
            }
            this.selectedId = null;
            this.open = false;
            this.rebuildState();
            return;
        }

        if (!this.entries.has(entryId)) {
            return;
        }

        if (this.selectedId === entryId && this.open) {
            return;
        }

        this.selectedId = entryId;
        this.open = true;
        this.rebuildState();
    }

    toggleSelect(entryId: SidebarEntryId): void {
        if (this.selectedId === entryId && this.open) {
            this.select(null);
            return;
        }
        this.select(entryId);
    }

    private getSortedEntries(): SidebarEntry<TData>[] {
        return Array.from(this.entries.values())
            .sort(
                (a, b) => a.priority - b.priority || a.order - b.order || a.id.localeCompare(b.id),
            )
            .map(({ order: _order, ...entry }) => entry);
    }

    private rebuildState(): void {
        const sortedEntries = this.getSortedEntries();

        // If the sidebar is open but nothing is selected yet, select the first available entry.
        if (this.open && this.selectedId === null) {
            this.selectedId = sortedEntries[0] ? sortedEntries[0].id : null;
        }

        this.version++;
        this.state = {
            open: this.open,
            selectedId: this.selectedId,
            entries: sortedEntries,
            version: this.version,
        };
        this.persistState();
        this.emit();
    }

    private persistState(): void {
        const persistence = this.persistence;
        if (!persistence) return;

        const payload: SidebarPersistedState = {
            open: this.state.open,
            selectedId: this.state.selectedId,
        };
        persistence.save(payload);
    }

    private emit(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (err) {
                console.log("[sidebar] listener failed", err);
            }
        }
    }
}
