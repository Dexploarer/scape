import type { ClientSidebarPluginDefinition } from "../../sidebar/pluginTypes";

export const GROUND_ITEMS_SIDEBAR_PLUGIN: ClientSidebarPluginDefinition = Object.freeze({
    id: "ground_items",
    title: "Ground Items",
    tooltip: "Ground Items",
    priority: 150,
    panelId: "ground_items",
    icon: ({ label }: { label: string }) => (
        <svg
            className="rl-sidebar-icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-label={label}
            aria-hidden="true"
        >
            <ellipse cx="12" cy="7" rx="6.5" ry="2.8" />
            <path d="M5.5 7v4c0 1.6 2.9 2.8 6.5 2.8s6.5-1.2 6.5-2.8V7" />
            <path d="M5.5 11v4c0 1.6 2.9 2.8 6.5 2.8s6.5-1.2 6.5-2.8v-4" />
        </svg>
    ),
});
