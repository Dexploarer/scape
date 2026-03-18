import type { ClientSidebarPluginDefinition } from "../../sidebar/pluginTypes";

export const INTERACT_HIGHLIGHT_SIDEBAR_PLUGIN: ClientSidebarPluginDefinition = Object.freeze({
    id: "interact_highlight",
    title: "Interact Highlight",
    tooltip: "Interact Highlight",
    priority: 175,
    panelId: "interact_highlight",
    icon: ({ label }: { label: string }) => (
        <svg
            className="rl-sidebar-icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-label={label}
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="6.3" />
            <circle cx="12" cy="12" r="1.8" />
            <path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21" />
        </svg>
    ),
});
