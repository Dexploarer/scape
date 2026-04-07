import type { MessageHandlerServices } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";
import { logger } from "../../utils/logger";

export function registerDebugHandler(router: MessageRouter, services: MessageHandlerServices): void {
    router.register("debug", (ctx) => {
        const payload = ctx.payload;
        const kind = payload.kind;

        if (kind === "projectiles_request") {
            const requestId = payload.requestId ?? Math.floor(Math.random() * 1e9);
            services.setPendingDebugRequest(requestId, ctx.ws);
            const message = services.encodeMessage({
                type: "debug",
                payload: { kind: "projectiles_request", requestId: requestId },
            });
            services.withDirectSendBypass("debug_proj_req", () =>
                services.broadcast(message, "debug_proj_req"),
            );
        } else if (kind === "projectiles_snapshot") {
            const reqId = payload.requestId;
            const requester = services.getPendingDebugRequest(reqId);
            if (requester && requester.readyState === 1) {
                try {
                    const forward = services.encodeMessage({
                        type: "debug",
                        payload: {
                            kind: "projectiles_snapshot",
                            requestId: reqId,
                            fromId: ctx.player ? ctx.player.id : undefined,
                            snapshot: payload.snapshot,
                        },
                    });
                    services.withDirectSendBypass("debug_proj_snapshot", () =>
                        services.sendWithGuard(requester, forward, "debug_proj_snapshot"),
                    );
                } catch (err) {
                    logger.warn("[debug] forward snapshot failed", err);
                }
            }
        } else if (kind === "anim_request") {
            const requestId = payload.requestId ?? Math.floor(Math.random() * 1e9);
            services.setPendingDebugRequest(requestId, ctx.ws);
            const message = services.encodeMessage({
                type: "debug",
                payload: { kind: "anim_request", requestId: requestId },
            });
            services.withDirectSendBypass("debug_anim_req", () =>
                services.broadcast(message, "debug_anim_req"),
            );
        } else if (kind === "anim_snapshot") {
            const reqId = payload.requestId;
            const requester = services.getPendingDebugRequest(reqId);
            if (requester && requester.readyState === 1) {
                try {
                    const forward = services.encodeMessage({
                        type: "debug",
                        payload: {
                            kind: "anim_snapshot",
                            requestId: reqId,
                            fromId: ctx.player ? ctx.player.id : undefined,
                            snapshot: payload.snapshot,
                        },
                    });
                    services.withDirectSendBypass("debug_anim_snapshot", () =>
                        services.sendWithGuard(requester, forward, "debug_anim_snapshot"),
                    );
                } catch (err) {
                    logger.warn("[debug] forward anim snapshot failed", err);
                }
            }
        } else if (kind === "set_var") {
            const target = ctx.player;
            if (target) {
                const value = payload.value ?? 0;
                let changed = false;
                if (payload.varbit !== undefined) {
                    const varbitId = payload.varbit;
                    if (varbitId >= 0) {
                        target.varps.setVarbitValue(varbitId, value);
                        changed = true;
                    }
                }
                if (payload.varp !== undefined) {
                    const varpId = payload.varp;
                    if (varpId >= 0) {
                        target.varps.setVarpValue(varpId, value);
                        changed = true;
                    }
                }
                if (changed) {
                    services.queueChatMessage({
                        messageType: "game",
                        text: `Debug: var set to ${value}.`,
                        targetPlayerIds: [target.id],
                    });
                }
            }
        }
    });
}
