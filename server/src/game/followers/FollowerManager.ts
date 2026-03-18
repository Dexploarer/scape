import { hasDirectReachToArea } from "../../pathfinding/DirectReach";
import { PathService } from "../../pathfinding/PathService";
import { NpcState } from "../npc";
import { NpcManager } from "../npcManager";
import { PlayerState } from "../player";
import {
    getDefaultFollowerVariant,
    getFollowerDefinitionByItemId,
    getFollowerVariant,
} from "./followerDefinitions";

const FOLLOWER_TELEPORT_DISTANCE = 12;
const FOLLOWER_STEP_BUDGET = 2;

type ActiveFollower = {
    playerId: number;
    npcId: number;
    itemId: number;
    npcTypeId: number;
    followReadyTick?: number;
    pendingOwnerTileSeparation?: boolean;
};

export type ActiveFollowerSnapshot = Readonly<ActiveFollower>;

interface PlayerLookup {
    getById(id: number): PlayerState | undefined;
}

type FollowerIndexListener = (playerId: number, followerNpcId: number | undefined) => void;

export class FollowerManager {
    private readonly followersByPlayerId = new Map<number, ActiveFollower>();
    private readonly playerIdByNpcId = new Map<number, number>();

    constructor(
        private readonly npcManager: NpcManager,
        private readonly players: PlayerLookup,
        private readonly pathService: PathService,
        private readonly onFollowerIndexChanged?: FollowerIndexListener,
        private readonly getCurrentTick: () => number = () => 0,
    ) {}

    addActiveNpcIds(out: Set<number>): void {
        for (const npcId of this.playerIdByNpcId.keys()) {
            out.add(npcId);
        }
    }

    getActiveFollower(playerId: number): ActiveFollowerSnapshot | undefined {
        return this.followersByPlayerId.get(playerId);
    }

    forEachActiveFollower(visitor: (follower: ActiveFollowerSnapshot) => void): void {
        for (const follower of this.followersByPlayerId.values()) {
            visitor(follower);
        }
    }

    restoreFollowerForPlayer(player: PlayerState): boolean {
        const state = player.getFollowerState();
        if (!state) {
            this.unregisterFollower(player.id);
            player.setActiveFollowerNpcId(undefined);
            this.onFollowerIndexChanged?.(player.id, undefined);
            return false;
        }
        const normalizedState = this.normalizeFollowerState(state.itemId, state.npcTypeId);
        if (!normalizedState) {
            this.unregisterFollower(player.id);
            player.clearFollowerState();
            player.setActiveFollowerNpcId(undefined);
            this.onFollowerIndexChanged?.(player.id, undefined);
            return false;
        }
        player.setFollowerState(normalizedState);

        const activeNpcId = player.getActiveFollowerNpcId();
        if (activeNpcId !== undefined) {
            const activeNpc = this.npcManager.getById(activeNpcId);
            if (activeNpc) {
                this.registerFollower(
                    player,
                    activeNpc,
                    normalizedState.itemId,
                    normalizedState.npcTypeId,
                );
                return true;
            }
            player.setActiveFollowerNpcId(undefined);
            this.unregisterFollower(player.id, activeNpcId);
        }

        const spawned = this.spawnFollowerNpc(
            player,
            normalizedState.itemId,
            normalizedState.npcTypeId,
        );
        return spawned !== undefined;
    }

    summonFollowerFromItem(
        player: PlayerState,
        itemId: number,
        npcTypeId: number,
    ): { ok: true; npcId: number } | { ok: false; reason: string } {
        const existing = player.getFollowerState();
        if (existing) {
            if (this.restoreFollowerForPlayer(player)) {
                return { ok: false, reason: "already_active" };
            }
            player.clearFollowerState();
            player.setActiveFollowerNpcId(undefined);
        }

        const normalizedState = this.normalizeFollowerState(itemId, npcTypeId);
        if (!normalizedState) {
            return { ok: false, reason: "spawn_failed" };
        }

        player.setFollowerState(normalizedState);
        const npc = this.spawnFollowerNpc(
            player,
            normalizedState.itemId,
            normalizedState.npcTypeId,
            {
                placement: "owner_tile_first",
                followReadyTick: this.getCurrentTick() + 1,
            },
        );
        if (!npc) {
            player.clearFollowerState();
            player.setActiveFollowerNpcId(undefined);
            return { ok: false, reason: "spawn_failed" };
        }
        return { ok: true, npcId: npc.id };
    }

    metamorphFollower(
        player: PlayerState,
        npcId: number,
    ): { ok: true; npcId: number; npcTypeId: number } | { ok: false; reason: string } {
        const npc = this.npcManager.getById(npcId);
        if (!npc) {
            return { ok: false, reason: "missing" };
        }
        const follower = npc.getFollowerState();
        if (!follower) {
            return { ok: false, reason: "not_follower" };
        }
        if (follower.ownerPlayerId !== player.id) {
            return { ok: false, reason: "not_owner" };
        }

        const state = player.getFollowerState();
        const itemId = state?.itemId ?? follower.itemId;
        const definition = getFollowerDefinitionByItemId(itemId);
        if (!definition) {
            return { ok: false, reason: "invalid_variant" };
        }
        const variants = definition.variants ?? [];
        if (variants.length < 2) {
            return { ok: false, reason: "invalid_variant" };
        }

        const currentIndex = variants.findIndex((variant) => variant.npcTypeId === npc.typeId);
        if (currentIndex === -1) {
            return { ok: false, reason: "invalid_variant" };
        }

        const nextVariant = variants[(currentIndex + 1) % variants.length];
        const spawnTile = this.resolveMorphSpawnTile(player, npc, nextVariant.npcTypeId);

        this.unregisterFollower(player.id, npc.id);
        this.npcManager.removeNpc(npc.id);

        player.setFollowerState({ itemId, npcTypeId: nextVariant.npcTypeId });
        const morphedNpc = this.npcManager.spawnTransientNpc({
            id: nextVariant.npcTypeId,
            x: spawnTile.x,
            y: spawnTile.y,
            level: player.level,
            wanderRadius: 0,
        });
        if (!morphedNpc) {
            player.setFollowerState({ itemId, npcTypeId: npc.typeId });
            const restoredNpc = this.spawnFollowerNpc(player, itemId, npc.typeId);
            if (!restoredNpc) {
                player.clearFollowerState();
                player.setActiveFollowerNpcId(undefined);
                return { ok: false, reason: "spawn_failed" };
            }
            return { ok: false, reason: "spawn_failed" };
        }

        this.registerFollower(player, morphedNpc, itemId, nextVariant.npcTypeId);
        return { ok: true, npcId: morphedNpc.id, npcTypeId: nextVariant.npcTypeId };
    }

    pickupFollower(
        player: PlayerState,
        npcId: number,
    ): { ok: true; itemId: number; npcTypeId: number } | { ok: false; reason: string } {
        const npc = this.npcManager.getById(npcId);
        if (!npc) {
            return { ok: false, reason: "missing" };
        }
        const follower = npc.getFollowerState();
        if (!follower) {
            return { ok: false, reason: "not_follower" };
        }
        if (follower.ownerPlayerId !== player.id) {
            return { ok: false, reason: "not_owner" };
        }
        const state = player.getFollowerState();
        const npcTypeId = state?.npcTypeId ?? npc.typeId;
        const itemId = state?.itemId ?? follower.itemId;

        this.unregisterFollower(player.id, npc.id);
        player.setActiveFollowerNpcId(undefined);
        player.clearFollowerState();
        this.npcManager.removeNpc(npc.id);

        return { ok: true, itemId, npcTypeId };
    }

    callFollower(player: PlayerState): { ok: true; npcId: number } | { ok: false; reason: string } {
        const state = player.getFollowerState();
        if (!state) {
            return { ok: false, reason: "missing" };
        }

        let active = this.followersByPlayerId.get(player.id);
        let npc = active ? this.npcManager.getById(active.npcId) : undefined;
        if (!npc) {
            const restored = this.restoreFollowerForPlayer(player);
            if (!restored) {
                return { ok: false, reason: "spawn_failed" };
            }
            active = this.followersByPlayerId.get(player.id);
            npc = active ? this.npcManager.getById(active.npcId) : undefined;
            if (!active || !npc) {
                return { ok: false, reason: "spawn_failed" };
            }
        }

        const tile = this.findPlacementTile(player, npc.size, npc.id);
        npc.clearPath();
        npc.setInteraction("player", player.id);
        npc.teleport(tile.x, tile.y, player.level);
        return { ok: true, npcId: npc.id };
    }

    despawnFollowerForPlayer(playerId: number, clearPersistentState = false): boolean {
        const player = this.players.getById(playerId);
        const active = this.followersByPlayerId.get(playerId);
        const npcId = active?.npcId ?? player?.getActiveFollowerNpcId();
        if (npcId === undefined) {
            if (player && clearPersistentState) {
                player.clearFollowerState();
            }
            this.onFollowerIndexChanged?.(playerId, undefined);
            return false;
        }

        this.unregisterFollower(playerId, npcId);
        if (player) {
            player.setActiveFollowerNpcId(undefined);
            if (clearPersistentState) {
                player.clearFollowerState();
            }
        }
        return this.npcManager.removeNpc(npcId);
    }

    tick(currentTick: number): void {
        for (const active of Array.from(this.followersByPlayerId.values())) {
            const player = this.players.getById(active.playerId);
            const npc = this.npcManager.getById(active.npcId);

            if (!player) {
                if (!npc) {
                    this.unregisterFollower(active.playerId, active.npcId);
                }
                continue;
            }

            if (!npc) {
                this.unregisterFollower(active.playerId, active.npcId);
                if (player.getFollowerState()) {
                    this.restoreFollowerForPlayer(player);
                }
                continue;
            }

            if (npc.isDead(currentTick)) {
                continue;
            }

            const distance = chebyshevDistance(player.tileX, player.tileY, npc.tileX, npc.tileY);
            if (player.level !== npc.level || distance > FOLLOWER_TELEPORT_DISTANCE) {
                const tile = this.findPlacementTile(player, npc.size, npc.id);
                npc.teleport(tile.x, tile.y, player.level);
                continue;
            }
            npc.setInteraction("player", player.id);

            const followReadyTick = active.followReadyTick ?? 0;
            if (currentTick < followReadyTick) {
                npc.clearPath();
                continue;
            }

            if (active.pendingOwnerTileSeparation) {
                if (player.level !== npc.level) {
                    active.pendingOwnerTileSeparation = false;
                } else if (npc.tileX === player.tileX && npc.tileY === player.tileY) {
                    const separationTile = this.findAdjacentPlacementTile(player, npc.size, npc.id);
                    if (separationTile) {
                        npc.clearPath();
                        npc.setPath([separationTile], false);
                        active.pendingOwnerTileSeparation = false;
                    }
                    continue;
                } else {
                    active.pendingOwnerTileSeparation = false;
                }
            }

            if (distance <= 1) {
                npc.clearPath();
                continue;
            }

            if (npc.hasPath()) {
                continue;
            }

            const target = this.getFollowTarget(player, npc);
            const steps: Array<{ x: number; y: number }> = [];
            let currentX = npc.tileX;
            let currentY = npc.tileY;

            for (let i = 0; i < FOLLOWER_STEP_BUDGET; i++) {
                const next = this.pathService.findNpcPathStep(
                    { x: currentX, y: currentY, plane: npc.level },
                    target,
                    npc.size,
                );
                if (!next) {
                    break;
                }
                if (next.x === player.tileX && next.y === player.tileY) {
                    break;
                }
                steps.push(next);
                currentX = next.x;
                currentY = next.y;
                if (chebyshevDistance(player.tileX, player.tileY, currentX, currentY) <= 1) {
                    break;
                }
            }

            if (steps.length > 0) {
                npc.setPath(steps, false);
            }
        }
    }

    private spawnFollowerNpc(
        player: PlayerState,
        itemId: number,
        npcTypeId: number,
        options: {
            placement?: "default" | "owner_tile_first";
            followReadyTick?: number;
        } = {},
    ): NpcState | undefined {
        const npcType = this.npcManager.loadNpcTypeById(npcTypeId);
        if (!npcType) {
            return undefined;
        }

        const size = Math.max(1, npcType.size);
        const tile =
            options.placement === "owner_tile_first"
                ? this.findOwnerTileFirstPlacementTile(player, size)
                : this.findPlacementTile(player, size);
        const npc = this.npcManager.spawnTransientNpc({
            id: npcTypeId,
            x: tile.x,
            y: tile.y,
            level: player.level,
            wanderRadius: 0,
        });
        if (!npc) {
            return undefined;
        }

        this.registerFollower(player, npc, itemId, npcTypeId, {
            followReadyTick: options.followReadyTick,
            pendingOwnerTileSeparation: tile.x === player.tileX && tile.y === player.tileY,
        });
        return npc;
    }

    private registerFollower(
        player: PlayerState,
        npc: NpcState,
        itemId: number,
        npcTypeId: number,
        options: {
            followReadyTick?: number;
            pendingOwnerTileSeparation?: boolean;
        } = {},
    ): void {
        const existing = this.followersByPlayerId.get(player.id);
        if (existing && existing.npcId !== npc.id) {
            this.playerIdByNpcId.delete(existing.npcId);
        }
        npc.setFollowerState(player.id, itemId);
        npc.setInteraction("player", player.id);
        player.setFollowerState({ itemId, npcTypeId });
        player.setActiveFollowerNpcId(npc.id);
        this.followersByPlayerId.set(player.id, {
            playerId: player.id,
            npcId: npc.id,
            itemId,
            npcTypeId,
            followReadyTick: options.followReadyTick,
            pendingOwnerTileSeparation: options.pendingOwnerTileSeparation,
        });
        this.playerIdByNpcId.set(npc.id, player.id);
        this.onFollowerIndexChanged?.(player.id, npc.id);
    }

    private unregisterFollower(playerId: number, npcId?: number): void {
        let changed = false;
        const active = this.followersByPlayerId.get(playerId);
        if (active) {
            this.followersByPlayerId.delete(playerId);
            this.playerIdByNpcId.delete(active.npcId);
            const activeNpc = this.npcManager.getById(active.npcId);
            activeNpc?.clearFollowerState();
            changed = true;
        }
        if (npcId !== undefined) {
            this.playerIdByNpcId.delete(npcId);
            const npc = this.npcManager.getById(npcId);
            npc?.clearFollowerState();
            changed = true;
        }
        if (changed) {
            this.onFollowerIndexChanged?.(playerId, undefined);
        }
    }

    private normalizeFollowerState(
        itemId: number,
        npcTypeId: number,
    ): { itemId: number; npcTypeId: number } | undefined {
        if (!(itemId > 0)) {
            return undefined;
        }
        const definition = getFollowerDefinitionByItemId(itemId);
        if (!definition) {
            return undefined;
        }
        const variant =
            getFollowerVariant(definition, npcTypeId) ?? getDefaultFollowerVariant(definition);
        return {
            itemId: itemId | 0,
            npcTypeId: variant.npcTypeId | 0,
        };
    }

    private getFollowTarget(player: PlayerState, npc: NpcState): { x: number; y: number } {
        const followX = player.followX | 0;
        const followY = player.followZ | 0;
        if (
            (followX !== player.tileX || followY !== player.tileY) &&
            !(followX === npc.tileX && followY === npc.tileY)
        ) {
            return { x: followX, y: followY };
        }
        return { x: player.tileX, y: player.tileY };
    }

    private findPlacementTile(
        player: PlayerState,
        size: number,
        ignoreNpcId?: number,
    ): { x: number; y: number } {
        const candidates: Array<{ x: number; y: number }> = [];
        const pushCandidate = (x: number, y: number): void => {
            if (candidates.some((candidate) => candidate.x === x && candidate.y === y)) {
                return;
            }
            candidates.push({ x, y });
        };

        if (player.followX !== player.tileX || player.followZ !== player.tileY) {
            pushCandidate(player.followX, player.followZ);
        }

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                pushCandidate(player.tileX + dx, player.tileY + dy);
            }
        }

        pushCandidate(player.tileX, player.tileY);

        for (const candidate of candidates) {
            if (
                this.isPlacementCandidateReachable(player, candidate, size) &&
                this.npcManager.canOccupyTile(
                    candidate.x,
                    candidate.y,
                    player.level,
                    size,
                    ignoreNpcId,
                )
            ) {
                return candidate;
            }
        }

        return { x: player.tileX, y: player.tileY };
    }

    private findOwnerTileFirstPlacementTile(
        player: PlayerState,
        size: number,
        ignoreNpcId?: number,
    ): { x: number; y: number } {
        const ownerTile = { x: player.tileX, y: player.tileY };
        if (
            this.isPlacementCandidateReachable(player, ownerTile, size) &&
            this.npcManager.canOccupyTile(ownerTile.x, ownerTile.y, player.level, size, ignoreNpcId)
        ) {
            return ownerTile;
        }

        const adjacent = this.findAdjacentPlacementTile(player, size, ignoreNpcId);
        if (adjacent) {
            return adjacent;
        }

        return this.findPlacementTile(player, size, ignoreNpcId);
    }

    private findAdjacentPlacementTile(
        player: PlayerState,
        size: number,
        ignoreNpcId?: number,
    ): { x: number; y: number } | undefined {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) {
                    continue;
                }

                const candidate = { x: player.tileX + dx, y: player.tileY + dy };
                if (
                    this.isPlacementCandidateReachable(player, candidate, size) &&
                    this.npcManager.canOccupyTile(
                        candidate.x,
                        candidate.y,
                        player.level,
                        size,
                        ignoreNpcId,
                    )
                ) {
                    return candidate;
                }
            }
        }

        return undefined;
    }

    private isPlacementCandidateReachable(
        player: PlayerState,
        candidate: { x: number; y: number },
        size: number,
    ): boolean {
        return hasDirectReachToArea(
            this.pathService,
            { x: player.tileX, y: player.tileY },
            candidate,
            size,
            size,
            player.level,
        );
    }

    private resolveMorphSpawnTile(
        player: PlayerState,
        npc: NpcState,
        npcTypeId: number,
    ): { x: number; y: number } {
        const npcType = this.npcManager.loadNpcTypeById(npcTypeId);
        const size = Math.max(1, npcType?.size ?? 1);
        if (this.npcManager.canOccupyTile(npc.tileX, npc.tileY, npc.level, size, npc.id)) {
            return { x: npc.tileX, y: npc.tileY };
        }
        return this.findPlacementTile(player, size, npc.id);
    }
}

function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}
