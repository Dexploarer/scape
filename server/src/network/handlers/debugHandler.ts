import type { MessageHandlerServices } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";
import { logger } from "../../utils/logger";

export function registerDebugHandler(router: MessageRouter, services: MessageHandlerServices): void {
    router.register("debug", (ctx) => {
        const payload = ctx.payload;
        const kind = payload.kind;
        const sendBotSdkJournalSnapshot = (requester = ctx.ws, targetPlayerId?: number) => {
            try {
                const snapshot = services.getBotSdkJournalSnapshot?.(targetPlayerId) ?? {
                    proposals: [],
                    activities: [],
                };
                const forward = services.encodeMessage({
                    type: "debug",
                    payload: {
                        kind: "bot_sdk_script_proposals_snapshot",
                        targetPlayerId,
                        proposals: snapshot.proposals,
                        activities: snapshot.activities,
                    },
                });
                services.withDirectSendBypass("debug_bot_sdk_script_proposals_snapshot", () =>
                    services.sendWithGuard(
                        requester,
                        forward,
                        "debug_bot_sdk_script_proposals_snapshot",
                    ),
                );
            } catch (err) {
                logger.warn("[debug] bot sdk proposal snapshot failed", err);
            }
        };

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
        } else if (kind === "bot_sdk_script") {
            const target = ctx.player;
            if (!target) return;
            const reply = (text: string) =>
                services.queueChatMessage({
                    messageType: "game",
                    text,
                    targetPlayerIds: [target.id],
                });
            const result = services.controlBotSdkScripts?.(payload) ?? {
                matched: 0,
                delivered: 0,
                failed: 0,
                failureMessages: [],
            };

            if (payload.operation === "install") {
                if (result.delivered > 0) {
                    reply(
                        `Installed script on ${result.delivered} agent${result.delivered === 1 ? "" : "s"}.`,
                    );
                } else if (result.failureMessages[0]) {
                    reply(`Bot SDK script error: ${result.failureMessages[0]}`);
                } else {
                    reply("No connected 'scape agents accepted the script.");
                }
            } else if (payload.operation === "clear") {
                if (result.delivered > 0) {
                    reply(
                        `Cleared scripts on ${result.delivered} agent${result.delivered === 1 ? "" : "s"}.`,
                    );
                } else if (result.failureMessages[0]) {
                    reply(`Bot SDK script error: ${result.failureMessages[0]}`);
                } else {
                    reply("No connected 'scape agents had an active script.");
                }
            } else if (payload.operation === "interrupt") {
                if (result.delivered > 0) {
                    reply(
                        `Interrupted ${result.delivered} agent${result.delivered === 1 ? "" : "s"} with ${payload.interrupt}.`,
                    );
                } else if (result.failureMessages[0]) {
                    reply(`Bot SDK script error: ${result.failureMessages[0]}`);
                } else {
                    reply(`No connected 'scape agents handled interrupt ${payload.interrupt}.`);
                }
            }
            sendBotSdkJournalSnapshot(ctx.ws, payload.targetPlayerId);
        } else if (kind === "bot_sdk_script_proposals_request") {
            sendBotSdkJournalSnapshot(ctx.ws, payload.targetPlayerId);
        } else if (kind === "bot_sdk_script_proposal_decision") {
            const target = ctx.player;
            if (!target) return;
            const reply = (text: string) =>
                services.queueChatMessage({
                    messageType: "game",
                    text,
                    targetPlayerIds: [target.id],
                });
            const result = services.decideBotSdkScriptProposal?.({
                proposalId: payload.proposalId,
                decision: payload.decision,
                reason: payload.reason,
            }) ?? {
                ok: false,
                message: "Bot SDK proposal decisions are unavailable.",
            };
            reply(result.message);
            sendBotSdkJournalSnapshot(ctx.ws);
        }
    });
}
