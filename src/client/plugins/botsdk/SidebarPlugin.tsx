import type { ClientSidebarPluginDefinition } from "../../sidebar/pluginTypes";

export const BOT_SDK_SIDEBAR_PLUGIN: ClientSidebarPluginDefinition = Object.freeze({
    id: "bot_sdk",
    title: "Bot SDK",
    tooltip: "Bot SDK",
    priority: 130,
    panelId: "bot_sdk",
    icon: ({ label }: { label: string }) => (
        <svg
            className="rl-sidebar-icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-label={label}
            aria-hidden="true"
        >
            <rect x="6" y="7" width="12" height="10" rx="1.6" />
            <path d="M9 7V5.2M15 7V5.2M4.5 12h1.8M17.7 12h1.8M9.5 11.2h.01M14.5 11.2h.01" />
            <path d="M10 14.6h4" />
        </svg>
    ),
});
