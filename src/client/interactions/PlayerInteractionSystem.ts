import {
    decodeInteractionIndex,
    encodeInteractionIndex,
} from "../../rs/interaction/InteractionIndex";
import type { OsrsClient } from "../OsrsClient";
import type { NpcEcs } from "../ecs/NpcEcs";
import { computeFacingRotation } from "../utils/rotation";

type InteractionMode = "follow" | "trade" | "combat";

/**
 * PlayerInteractionSystem owns client-side interaction state (follow/trade) and
 * per-tick facing updates. It does not send network packets; callers should
 * invoke server messages separately. When connected, this system limits itself
 * to orientation snaps only. In offline/demo mode it may be extended to plan
 * local routes.
 */
export class PlayerInteractionSystem {
    private active?: {
        mode: InteractionMode;
        targetServerId: number;
    };
    private activeOrigin?: "client" | "server";
    private faceTile?: { x: number; y: number };

    constructor(private mv: OsrsClient) {}

    beginFollow(targetServerId: number): void {
        if (targetServerId == null) return;
        this.active = { mode: "follow", targetServerId: targetServerId | 0 };
        this.activeOrigin = "client";
        this.faceTile = undefined;
        // Set interaction index on local player so rotation system knows we're following
        try {
            const pe = this.mv.playerEcs;
            const idx = pe.getIndexForServerId(this.mv.controlledPlayerServerId);
            if (idx !== undefined) {
                pe.setInteractionIndex(idx, encodeInteractionIndex("player", targetServerId | 0));
            }
        } catch {}
        // Close any open menu immediately for responsiveness
        try {
            this.mv.closeMenu();
        } catch {}
    }

    beginTrade(targetServerId: number): void {
        if (targetServerId == null) return;
        this.active = { mode: "trade", targetServerId: targetServerId | 0 };
        this.activeOrigin = "client";
        this.faceTile = undefined;
        // Set interaction index on local player
        try {
            const pe = this.mv.playerEcs;
            const idx = pe.getIndexForServerId(this.mv.controlledPlayerServerId);
            if (idx !== undefined) {
                pe.setInteractionIndex(idx, encodeInteractionIndex("player", targetServerId | 0));
            }
        } catch {}
        try {
            this.mv.closeMenu();
        } catch {}
    }

    beginCombat(targetServerId: number, opts?: { tile?: { x: number; y: number } }): void {
        if (targetServerId == null) return;
        this.active = { mode: "combat", targetServerId: targetServerId | 0 };
        this.activeOrigin = "client";
        this.faceTile = opts?.tile ? { x: opts.tile.x | 0, y: opts.tile.y | 0 } : undefined;
        try {
            this.mv.closeMenu();
        } catch {}
    }

    beginFaceTile(tileX: number, tileY: number): void {
        this.faceTile = { x: tileX | 0, y: tileY | 0 };
    }

    clearFaceTile(): void {
        this.faceTile = undefined;
    }

    cancel(reason?: string): void {
        this.active = undefined;
        this.activeOrigin = undefined;
        this.faceTile = undefined;
        // Realign the controlled player's facing back to movement orientation to
        // avoid a brief client/server mismatch right after cancelling follow.
        try {
            const pe = this.mv.playerEcs;
            const idx = pe.getIndexForServerId(this.mv.controlledPlayerServerId);
            if (idx !== undefined) {
                try {
                    pe.setInteractionIndex(idx, undefined);
                } catch {}
                const cx = pe.getX(idx) | 0;
                const cy = pe.getY(idx) | 0;
                const tx = pe.getTargetX(idx) | 0;
                const ty = pe.getTargetY(idx) | 0;

                // Only update rotation if player is actually moving (target differs from current position)
                // Prevents rotation towards stale path targets when stationary
                const ctx = (cx >> 7) | 0;
                const cty = (cy >> 7) | 0;
                const ttx = (tx >> 7) | 0;
                const tty = (ty >> 7) | 0;

                if (ctx !== ttx || cty !== tty) {
                    let or = pe.getTargetRotation(idx) | 0;
                    if (ctx < ttx) {
                        if (cty < tty) or = 1280;
                        else if (cty > tty) or = 1792;
                        else or = 1536;
                    } else if (ctx > ttx) {
                        if (cty < tty) or = 768;
                        else if (cty > tty) or = 256;
                        else or = 512;
                    } else if (cty < tty) or = 1024;
                    else if (cty > tty) or = 0;
                    pe.setTargetRot(idx, or & 2047);
                }
            }
        } catch {}
    }

    syncServerInteraction(interactionIndex?: number): void {
        if (typeof interactionIndex !== "number" || interactionIndex < 0) {
            if (this.activeOrigin !== "client") {
                this.active = undefined;
                this.faceTile = undefined;
                this.activeOrigin = undefined;
            }
            return;
        }
        const decoded = decodeInteractionIndex(interactionIndex);
        if (!decoded) {
            if (this.activeOrigin !== "client") {
                this.active = undefined;
                this.faceTile = undefined;
                this.activeOrigin = undefined;
            }
            return;
        }
        const derivedMode: InteractionMode = decoded.type === "npc" ? "combat" : "follow";
        const targetId = decoded.id | 0;
        if (
            this.activeOrigin === "client" &&
            this.active &&
            this.active.mode === derivedMode &&
            this.active.targetServerId === targetId
        ) {
            return;
        }
        if (this.activeOrigin === "client") return;
        if (
            this.activeOrigin === "server" &&
            this.active &&
            this.active.mode === derivedMode &&
            this.active.targetServerId === targetId
        ) {
            return;
        }
        this.active = { mode: derivedMode, targetServerId: targetId };
        this.faceTile = undefined;
        this.activeOrigin = "server";
    }

    /**
     * Apply per-client-tick facing toward interaction targets for both the
     * controlled player and remotes. Rotation is driven toward the target each
     * tick (no snap), matching OSRS behavior where the movement animation may
     * side-step while facing the target.
     */
    tickClient(clientTicks: number = 1): void {
        try {
            const pe = this.mv.playerEcs;
            for (let tick = 0; tick < clientTicks; tick++) {
                // Local controlled player
                if (this.active) {
                    const localIdx = pe.getIndexForServerId(this.mv.controlledPlayerServerId);
                    if (localIdx !== undefined) {
                        const mode = this.active.mode;
                        if (mode === "combat") {
                            const npcPos = this.getNpcWorldPosition(this.active.targetServerId);
                            if (npcPos) {
                                const px = pe.getX(localIdx) | 0;
                                const py = pe.getY(localIdx) | 0;
                                const rot = computeFacingRotation(px - npcPos.x, py - npcPos.y);
                                if (rot !== undefined) {
                                    pe.setTargetRot(localIdx, rot);
                                }
                                this.faceTile = {
                                    x: (npcPos.x >> 7) | 0,
                                    y: (npcPos.y >> 7) | 0,
                                };
                            } else if (this.faceTile) {
                                const px = pe.getX(localIdx) | 0;
                                const py = pe.getY(localIdx) | 0;
                                const tx = ((this.faceTile.x | 0) * 128 + 64) | 0;
                                const ty = ((this.faceTile.y | 0) * 128 + 64) | 0;
                                const rot = computeFacingRotation(px - tx, py - ty);
                                if (rot !== undefined) {
                                    pe.setTargetRot(localIdx, rot);
                                }
                            }
                        } else {
                            // Use current positions (already interpolated after updateClient)
                            const targetIdx = pe.getIndexForServerId(this.active.targetServerId);
                            if (targetIdx !== undefined) {
                                const px = pe.getX(localIdx) | 0;
                                const py = pe.getY(localIdx) | 0;
                                const tx = pe.getX(targetIdx) | 0;
                                const ty = pe.getY(targetIdx) | 0;
                                const dx = (px - tx) | 0;
                                const dy = (py - ty) | 0;
                                const rot = computeFacingRotation(dx, dy);
                                if (rot !== undefined) {
                                    pe.setTargetRot(localIdx, rot);
                                }
                            }
                        }
                    }
                }
                // If no active follow/trade, but we have a faceTile target, keep facing it
                if (!this.active && this.faceTile) {
                    const localIdx = pe.getIndexForServerId(this.mv.controlledPlayerServerId);
                    if (localIdx !== undefined) {
                        const px = pe.getX(localIdx) | 0;
                        const py = pe.getY(localIdx) | 0;
                        const tx = ((this.faceTile.x | 0) * 128 + 64) | 0;
                        const ty = ((this.faceTile.y | 0) * 128 + 64) | 0;
                        const rot = computeFacingRotation(px - tx, py - ty);
                        if (rot !== undefined) {
                            pe.setTargetRot(localIdx, rot);
                        }
                        const dx = px - tx;
                        const dy = py - ty;
                        // Clear when close enough to center (~half tile)
                        if (dx * dx + dy * dy <= 64 * 64) {
                            this.faceTile = undefined;
                        }
                    } else {
                        this.faceTile = undefined;
                    }
                }
                // For remotes, orientation is server-driven; no client-facing correction.
            }
        } catch {}
    }

    private getNpcWorldPosition(serverId: number): { x: number; y: number } | undefined {
        const npcEcs: NpcEcs = this.mv.npcEcs;
        const idx = npcEcs.getEcsIdForServer(serverId | 0);
        if (idx == null) return undefined;
        try {
            const mapId = npcEcs.getMapId(idx);
            const localX = npcEcs.getX(idx) | 0;
            const localY = npcEcs.getY(idx) | 0;
            const mapX = (mapId >> 8) & 0xff;
            const mapY = mapId & 0xff;
            const worldX = (mapX << 13) + (localX | 0);
            const worldY = (mapY << 13) + (localY | 0);
            return { x: worldX | 0, y: worldY | 0 };
        } catch {
            return undefined;
        }
    }
}
