import type { MessageHandlerServices } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";
import { logger } from "../../utils/logger";

export function registerSpellHandlers(router: MessageRouter, services: MessageHandlerServices): void {
    router.register("spell_cast_npc", (ctx) => {
        try {
            if (ctx.player) {
                services.handleSpellCast(
                    ctx.ws,
                    ctx.player,
                    ctx.payload,
                    "npc",
                    services.currentTick(),
                );
            }
        } catch (err) {
            logger.warn("[combat] spell_cast_npc dispatch failed", err);
        }
    });

    router.register("spell_cast_player", (ctx) => {
        try {
            logger.info("[combat] Received spell_cast_player:", JSON.stringify(ctx.payload));
            if (ctx.player) {
                services.handleSpellCast(
                    ctx.ws,
                    ctx.player,
                    ctx.payload,
                    "player",
                    services.currentTick(),
                );
            }
        } catch (err) {
            logger.warn("[combat] spell_cast_player dispatch failed", err);
        }
    });

    router.register("spell_cast_loc", (ctx) => {
        try {
            if (ctx.player) {
                services.handleSpellCast(
                    ctx.ws,
                    ctx.player,
                    ctx.payload,
                    "loc",
                    services.currentTick(),
                );
            }
        } catch (err) {
            logger.warn("[combat] spell_cast_loc dispatch failed", err);
        }
    });

    router.register("spell_cast_obj", (ctx) => {
        try {
            if (ctx.player) {
                services.handleSpellCast(
                    ctx.ws,
                    ctx.player,
                    ctx.payload,
                    "obj",
                    services.currentTick(),
                );
            }
        } catch (err) {
            logger.warn("[combat] spell_cast_obj dispatch failed", err);
        }
    });

    router.register("spell_cast_item", (ctx) => {
        try {
            services.handleSpellCastOnItem(ctx.ws, ctx.payload);
        } catch (err) {
            logger.warn("[magic] spell_cast_item dispatch failed", err);
        }
    });
}
