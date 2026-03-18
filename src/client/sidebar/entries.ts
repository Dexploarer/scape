import { GROUND_ITEMS_SIDEBAR_PLUGIN } from "../plugins/grounditems/SidebarPlugin";
import { INTERACT_HIGHLIGHT_SIDEBAR_PLUGIN } from "../plugins/interacthighlight/SidebarPlugin";
import { NOTES_SIDEBAR_PLUGIN } from "../plugins/notes/SidebarPlugin";
import { PLUGIN_HUB_SIDEBAR_PLUGIN } from "../plugins/pluginhub/SidebarPlugin";
import { TILE_MARKERS_SIDEBAR_PLUGIN } from "../plugins/tilemarkers/SidebarPlugin";
import type { SidebarStore } from "./SidebarStore";
import type {
    ClientSidebarPluginDefinition,
    SidebarPanelId,
    SidebarRailIconRenderer,
} from "./pluginTypes";
import type { SidebarEntryDefinition } from "./types";

export type { SidebarPanelId } from "./pluginTypes";

export interface ClientSidebarEntryData {
    icon: SidebarRailIconRenderer;
    panelId: SidebarPanelId;
}

export interface SidebarPluginVisibilityOptions {
    groundItemsEnabled?: boolean;
    interactHighlightEnabled?: boolean;
    notesEnabled?: boolean;
    tileMarkersEnabled?: boolean;
}

const DEFAULT_CLIENT_SIDEBAR_PLUGINS: ReadonlyArray<ClientSidebarPluginDefinition> = Object.freeze([
    PLUGIN_HUB_SIDEBAR_PLUGIN,
    GROUND_ITEMS_SIDEBAR_PLUGIN,
    TILE_MARKERS_SIDEBAR_PLUGIN,
    INTERACT_HIGHLIGHT_SIDEBAR_PLUGIN,
    NOTES_SIDEBAR_PLUGIN,
]);

function toEntryDefinition(
    plugin: ClientSidebarPluginDefinition,
): SidebarEntryDefinition<ClientSidebarEntryData> {
    return {
        id: plugin.id,
        title: plugin.title,
        tooltip: plugin.tooltip,
        priority: plugin.priority,
        data: {
            icon: plugin.icon,
            panelId: plugin.panelId,
        },
    };
}

function isPluginVisible(pluginId: string, options: SidebarPluginVisibilityOptions): boolean {
    if (pluginId === "ground_items") {
        return options.groundItemsEnabled !== false;
    }
    if (pluginId === "interact_highlight") {
        return options.interactHighlightEnabled !== false;
    }
    if (pluginId === "notes") {
        return options.notesEnabled !== false;
    }
    if (pluginId === "tile_markers") {
        return options.tileMarkersEnabled !== false;
    }
    return true;
}

function getVisibleEntries(
    options: SidebarPluginVisibilityOptions,
): ReadonlyArray<SidebarEntryDefinition<ClientSidebarEntryData>> {
    return DEFAULT_CLIENT_SIDEBAR_PLUGINS.filter((plugin) =>
        isPluginVisible(plugin.id, options),
    ).map(toEntryDefinition);
}

export function registerDefaultClientSidebarEntries(
    sidebar: SidebarStore<ClientSidebarEntryData>,
    options: SidebarPluginVisibilityOptions = {},
): void {
    const prevState = sidebar.getState();
    const visibleEntries = getVisibleEntries(options);
    const visibleEntryIds = new Set(visibleEntries.map((entry) => entry.id));
    const selectedId = sidebar.getState().selectedId;

    if (selectedId) {
        const selectedEntry = visibleEntries.find((entry) => entry.id === selectedId);
        if (selectedEntry) {
            sidebar.register(selectedEntry);
        }
    }

    for (const entry of visibleEntries) {
        if (entry.id === selectedId) {
            continue;
        }
        sidebar.register(entry);
    }

    for (const plugin of DEFAULT_CLIENT_SIDEBAR_PLUGINS) {
        if (visibleEntryIds.has(plugin.id)) {
            continue;
        }
        sidebar.unregister(plugin.id);
    }

    if (!selectedId) {
        return;
    }

    const state = sidebar.getState();
    const selectedExists = state.entries.some((entry) => entry.id === selectedId);
    if (selectedExists) {
        return;
    }

    if (prevState.open) {
        const fallbackEntryId = state.entries[0] ? state.entries[0].id : null;
        sidebar.select(fallbackEntryId);
        return;
    }

    sidebar.select(null);
}
