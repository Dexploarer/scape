import type { MessageHandlerServices } from "../MessageHandlers";
import { normalizeModifierFlags, resolveRunWithModifier } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";
import { logger } from "../../utils/logger";

export function registerNpcHandlers(router: MessageRouter, services: MessageHandlerServices): void {
    router.register("npc_attack", (ctx) => {
        try {
            const { npcId } = ctx.payload;
            const npc = services.getNpcById(npcId);
            if (!npc) {
                logger.info?.(`[combat] npc ${npcId} not found for attack`);
                return;
            }
            const tick = services.currentTick();
            const attackSpeed = ctx.player ? services.pickAttackSpeed(ctx.player) : 4;
            const res = services.startNpcAttack(ctx.ws, npc, tick, attackSpeed);
            if (!res.ok) {
                logger.info?.(
                    `[combat] npc attack rejected: ${res.message || "no_path"} (npc=${npcId})`,
                );
                if (res.chatMessage && ctx.player) {
                    services.queueChatMessage({
                        messageType: "game",
                        text: res.chatMessage,
                        targetPlayerIds: [ctx.player.id],
                    });
                }
            } else if (ctx.player) {
                ctx.player.setInteraction("npc", npc.id);
                services.startCombat(ctx.player, npc, tick, attackSpeed);
            }
        } catch (err) {
            logger.warn("[combat] npc_attack handling failed", err);
        }
    });

    router.register("npc_interact", (ctx) => {
        try {
            // Starting an interaction should consume any stale queued walk click.
            services.clearPendingWalkCommand(ctx.ws);
            const {
                npcId,
                option: rawOption,
                opNum,
                modifierFlags: rawModifierFlags,
            } = ctx.payload;
            const npc = services.getNpcById(npcId);
            const player = ctx.player;
            if (!npc) {
                logger.info?.(`[npc] interact target ${npcId} not found`);
                return;
            }
            const optionFromOpNum =
                opNum !== undefined && opNum > 0
                    ? services.resolveNpcOption(npc, opNum)
                    : undefined;
            const option = rawOption && rawOption.length > 0 ? rawOption : optionFromOpNum;
            const modifierFlags = normalizeModifierFlags(rawModifierFlags);
            const optNorm = (option ?? "").trim().toLowerCase();
            logger.info?.(
                `[npc] recv npc_interact player=${player?.id ?? "?"} opt=${
                    option ?? "Talk-to"
                } npc=${npcId} type=${npc?.typeId ?? "?"} playerPos=(${player?.tileX ?? "?"},${
                    player?.tileY ?? "?"
                },${player?.level ?? "?"})`,
            );

            // "Attack" is encoded as a regular NPC option packet (OPNPC*),
            // not a dedicated attack message, so route it through combat here.
            if (optNorm === "attack") {
                const tick = services.currentTick();
                const attackSpeed = ctx.player ? services.pickAttackSpeed(ctx.player) : 4;
                const res = services.startNpcAttack(ctx.ws, npc, tick, attackSpeed, modifierFlags);
                if (!res.ok) {
                    logger.info?.(
                        `[combat] npc attack rejected: ${res.message || "no_path"} (npc=${npcId})`,
                    );
                    if (res.chatMessage && ctx.player) {
                        services.queueChatMessage({
                            messageType: "game",
                            text: res.chatMessage,
                            targetPlayerIds: [ctx.player.id],
                        });
                    }
                } else if (ctx.player) {
                    ctx.player.setInteraction("npc", npc.id);
                    services.startCombat(ctx.player, npc, tick, attackSpeed);
                }
                return;
            }

            // Handle banking over the counter
            if (optNorm === "bank" && player) {
                const canBank = services.hasNpcOption(npc, "bank");
                if (canBank) {
                    const sameLevel = player.level === npc.level;
                    const px = player.tileX;
                    const py = player.tileY;
                    const tx = npc.tileX;
                    const ty = npc.tileY;
                    const size = Math.max(1, npc.size);
                    const minNx = tx;
                    const minNy = ty;
                    const maxNx = tx + size - 1;
                    const maxNy = ty + size - 1;
                    const dx = px < minNx ? minNx - px : px > maxNx ? px - maxNx : 0;
                    const dy = py < minNy ? minNy - py : py > maxNy ? py - maxNy : 0;
                    const dCheb = Math.max(dx, dy);

                    if (sameLevel && dCheb === 1) {
                        let canBankFromPos = false;
                        if (px >= minNx && px <= maxNx) {
                            const ny = py < minNy ? py + 1 : py > maxNy ? py - 1 : py;
                            const hasWall = services.edgeHasWallBetween(
                                px,
                                py,
                                px,
                                ny,
                                player.level,
                            );
                            if (!hasWall) canBankFromPos = true;
                        } else if (py >= minNy && py <= maxNy) {
                            const nx = px < minNx ? px + 1 : px > maxNx ? px - 1 : px;
                            const hasWall = services.edgeHasWallBetween(
                                px,
                                py,
                                nx,
                                py,
                                player.level,
                            );
                            if (!hasWall) canBankFromPos = true;
                        }

                        if (canBankFromPos) {
                            try {
                                services.startNpcInteraction(ctx.ws, npc, option, modifierFlags);
                            } catch (err) { logger.warn("Failed to start NPC bank interaction", err); }
                            return;
                        } else {
                            const isCardinallyAligned =
                                (px >= minNx && px <= maxNx) || (py >= minNy && py <= maxNy);
                            if (isCardinallyAligned) {
                                services.queueChatMessage({
                                    messageType: "game",
                                    text: "I can't reach that.",
                                    targetPlayerIds: [player.id],
                                });
                                return;
                            }
                        }
                    }

                    // Route player to nearest tile around NPC
                    let routed = false;
                    for (let ringRadius = 1; ringRadius <= 4 && !routed; ringRadius++) {
                        const candidates: { x: number; y: number }[] = [];
                        for (let x = minNx - ringRadius; x <= maxNx + ringRadius; x++) {
                            candidates.push({ x, y: minNy - ringRadius });
                            candidates.push({ x, y: maxNx + ringRadius });
                        }
                        for (let y = minNy - ringRadius; y <= maxNy + ringRadius; y++) {
                            candidates.push({ x: minNx - ringRadius, y });
                            candidates.push({ x: maxNx + ringRadius, y });
                        }
                        const uniq = new Map<string, { x: number; y: number }>();
                        for (const c of candidates) uniq.set(`${c.x}|${c.y}`, c);
                        const sorted = Array.from(uniq.values()).sort((a, b) => {
                            const da = Math.max(Math.abs(a.x - px), Math.abs(a.y - py));
                            const db = Math.max(Math.abs(b.x - px), Math.abs(b.y - py));
                            return da - db;
                        });

                        for (const slot of sorted) {
                            const res = services.findPath({
                                from: { x: px, y: py, plane: player.level },
                                to: { x: slot.x, y: slot.y },
                                size: 1,
                            });
                            if (
                                res.ok &&
                                Array.isArray(res.waypoints) &&
                                res.waypoints.length > 0
                            ) {
                                const run = player.energy.resolveRequestedRun(
                                    resolveRunWithModifier(player.energy.wantsToRun(), modifierFlags),
                                );
                                services.routePlayer(
                                    ctx.ws,
                                    { x: slot.x, y: slot.y },
                                    run,
                                    services.currentTick(),
                                );
                                try {
                                    services.startNpcInteraction(
                                        ctx.ws,
                                        npc,
                                        option,
                                        modifierFlags,
                                    );
                                } catch (err) { logger.warn("Failed to start NPC interaction after walk", err); }
                                routed = true;
                                break;
                            }
                        }
                    }
                    if (!routed && sameLevel && dCheb <= 4) {
                        services.queueChatMessage({
                            messageType: "game",
                            text: "I can't reach that.",
                            targetPlayerIds: [player.id],
                        });
                        return;
                    }
                    if (routed) return;
                }
            }

            const res = services.startNpcInteraction(ctx.ws, npc, option, modifierFlags);
            if (!res?.ok) {
                logger.info?.(
                    `[npc] interaction rejected: ${res?.message || "invalid"} (npc=${npcId})`,
                );
            }
        } catch (err) {
            logger.warn("[npc] npc_interact handling failed", err);
        }
    });
}
