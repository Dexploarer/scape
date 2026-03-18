import type { ClientSidebarPluginDefinition } from "../../sidebar/pluginTypes";

export const TILE_MARKERS_SIDEBAR_PLUGIN: ClientSidebarPluginDefinition = Object.freeze({
    id: "tile_markers",
    title: "Tile Markers",
    tooltip: "Tile Markers",
    priority: 160,
    panelId: "tile_markers",
    icon: ({ label }: { label: string }) => (
        <svg
            className="rl-sidebar-icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-label={label}
            aria-hidden="true"
        >
            <rect x="4.5" y="4.5" width="7" height="7" />
            <rect x="12.5" y="12.5" width="7" height="7" />
            <path d="M12 12 14.8 9.2M14.8 9.2v2.4M14.8 9.2h-2.4" />
        </svg>
    ),
});
