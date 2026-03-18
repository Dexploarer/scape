import type { JSX } from "react";

export type SidebarPanelId = string;

export type SidebarRailIconRenderer = (props: { label: string }) => JSX.Element;

export interface ClientSidebarPluginDefinition {
    id: string;
    title: string;
    tooltip?: string;
    priority: number;
    panelId: SidebarPanelId;
    icon: SidebarRailIconRenderer;
}
