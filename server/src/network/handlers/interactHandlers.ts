import type { MessageHandlerServices } from "../MessageHandlers";
import { normalizeModifierFlags } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";
import { logger } from "../../utils/logger";

export function registerInteractHandlers(router: MessageRouter, services: MessageHandlerServices): void {
    router.register("interact", (ctx) => {
        const { mode = "follow", targetId, modifierFlags: rawModifierFlags } = ctx.payload;
        const modifierFlags = normalizeModifierFlags(rawModifierFlags);
        try {
            const res = services.startFollowing(ctx.ws, targetId, mode, modifierFlags);
            if (!res?.ok) {
                logger.info(`interact rejected: ${res?.message || "invalid"}`);
            }
        } catch (err) { logger.warn("Failed to start player interaction", err); }
    });

    router.register("player_attack", (ctx) => {
        try {
            const player = ctx.player;
            if (!player) return;
            services.clearPendingWalkCommand(ctx.ws);
            const targetId = ctx.payload.playerId;
            if (targetId <= 0 || targetId === player.id) return;
            const target = services.getPlayerById(targetId);
            if (!target) {
                logger.info?.(`[combat] player ${targetId} not found for attack`);
                return;
            }
            services.startPlayerCombat(ctx.ws, target.id);
        } catch (err) {
            logger.warn("[combat] player_attack handling failed", err);
        }
    });

    router.register("loc_interact", (ctx) => {
        try {
            // Starting an interaction should consume any stale queued walk click.
            services.clearPendingWalkCommand(ctx.ws);
            const {
                id,
                tile,
                level,
                action: rawAction,
                opNum,
                modifierFlags: rawModifierFlags,
            } = ctx.payload;
            const modifierFlags = normalizeModifierFlags(rawModifierFlags);
            const actionFromOpNum =
                opNum !== undefined && opNum > 0
                    ? services.resolveLocAction(ctx.player, id, opNum)
                    : undefined;
            const action = rawAction && rawAction.length > 0 ? rawAction : actionFromOpNum;
            services.startLocInteract(
                ctx.ws,
                {
                    id,
                    tile,
                    level,
                    action,
                    modifierFlags,
                },
                services.currentTick(),
            );
        } catch (err) { logger.warn("Failed to start loc interaction", err); }
    });

    router.register("trade_action", (ctx) => {
        if (!ctx.player) return;
        try {
            services.handleTradeAction(ctx.player, ctx.payload, services.currentTick());
        } catch (err) {
            logger.warn("[trade] action handling failed", err);
        }
    });
}
