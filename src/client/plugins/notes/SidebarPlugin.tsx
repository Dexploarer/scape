import type { ClientSidebarPluginDefinition } from "../../sidebar/pluginTypes";

export const NOTES_SIDEBAR_PLUGIN: ClientSidebarPluginDefinition = Object.freeze({
    id: "notes",
    title: "Journal",
    tooltip: "Agent Journal",
    priority: 200,
    panelId: "notes",
    icon: ({ label }: { label: string }) => (
        <svg
            className="rl-sidebar-icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-label={label}
            aria-hidden="true"
        >
            <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
            <path d="M9 3.5v17M11.5 8.5h5M11.5 12h5M11.5 15.5h4" />
        </svg>
    ),
});
