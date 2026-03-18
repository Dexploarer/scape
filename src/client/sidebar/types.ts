export type SidebarEntryId = string;

export interface SidebarEntryDefinition<TData = unknown> {
    id: SidebarEntryId;
    title: string;
    tooltip?: string;
    priority?: number;
    data?: TData;
}

export interface SidebarEntry<TData = unknown> {
    id: SidebarEntryId;
    title: string;
    tooltip?: string;
    priority: number;
    data?: TData;
}

export interface SidebarState<TData = unknown> {
    open: boolean;
    selectedId: SidebarEntryId | null;
    entries: ReadonlyArray<SidebarEntry<TData>>;
    version: number;
}

export interface SidebarPersistedState {
    open: boolean;
    selectedId: SidebarEntryId | null;
}

export interface SidebarPersistence {
    load(): SidebarPersistedState | undefined;
    save(state: SidebarPersistedState): void;
}
