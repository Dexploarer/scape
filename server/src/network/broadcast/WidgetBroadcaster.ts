import type { WidgetAction } from "../../widgets/WidgetManager";
import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";
import { encodeMessage } from "../messages";
import type { BroadcastContext, BroadcastDomain } from "./BroadcastDomain";

export interface WidgetBroadcasterServices {
    syncPostWidgetOpenState(playerId: number, action: WidgetAction): void;
}

/**
 * Broadcasts widget open/close events to players.
 *
 * close events are sent BEFORE varps/varbits to prevent
 * re-render flicker. Non-close events are sent AFTER varps/varbits
 * so scripts have correct state when interfaces open.
 *
 * This broadcaster is called twice per tick:
 *   1. flushCloseEvents() - before VarBroadcaster
 *   2. flushOpenEvents() - after VarBroadcaster
 */
export class WidgetBroadcaster implements BroadcastDomain {
    constructor(private readonly services: WidgetBroadcasterServices) {}

    flush(_frame: TickFrame, _ctx: BroadcastContext): void {
        // Use flushCloseEvents() and flushOpenEvents() separately instead.
        // This method exists to satisfy the BroadcastDomain interface but
        // the split ordering is managed by the coordinator.
    }

    flushCloseEvents(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.widgetEvents || frame.widgetEvents.length === 0) return;

        const closeEvents = frame.widgetEvents.filter(
            (evt: { action?: WidgetAction }) =>
                evt.action?.action === "close_sub" || evt.action?.action === "close",
        );
        for (const evt of closeEvents) {
            const sock = ctx.getSocketByPlayerId(evt.playerId);
            ctx.sendWithGuard(
                sock,
                encodeMessage({ type: "widget", payload: evt.action }),
                "widget_close_event",
            );
        }
    }

    flushOpenEvents(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.widgetEvents || frame.widgetEvents.length === 0) return;

        const nonCloseEvents = frame.widgetEvents.filter(
            (evt: { action?: WidgetAction }) =>
                evt.action?.action !== "close_sub" && evt.action?.action !== "close",
        );
        for (const evt of nonCloseEvents) {
            const sock = ctx.getSocketByPlayerId(evt.playerId);
            ctx.sendWithGuard(
                sock,
                encodeMessage({ type: "widget", payload: evt.action }),
                "widget_event",
            );
            this.services.syncPostWidgetOpenState(evt.playerId, evt.action);
        }
    }
}
