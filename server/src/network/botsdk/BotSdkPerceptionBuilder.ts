/**
 * Builds bounded {@link AgentPerceptionSnapshot} values from live game state.
 *
 * This is the one place where the server translates raw runtime state into the
 * compact TOON-facing context an autonomous agent consumes. The shape is kept
 * additive-only so older bot-SDK clients can continue ignoring fields they do
 * not understand.
 */

import {
    SKILL_IDS,
    SKILL_NAME,
} from "../../../../src/rs/skill/skills";
import type {
    AgentPerceptionEvent,
    AgentPerceptionGroundItem,
    AgentPerceptionInventoryItem,
    AgentPerceptionNpc,
    AgentPerceptionObject,
    AgentPerceptionPlayer,
    AgentPerceptionSelf,
    AgentPerceptionSkill,
    AgentPerceptionSnapshot,
} from "../../agent";
import { getItemDefinition } from "../../data/items";
import type { PlayerState } from "../../game/player";
import type { ServerServices } from "../../game/ServerServices";
import type { DynamicLocChangeState } from "../../world/DynamicLocStateStore";
import type { LocTilePlacement } from "../../world/LocTileLookupService";

const DEFAULT_PERCEPTION_RADIUS = 12;
const DEFAULT_MAX_NEARBY_NPCS = 12;
const DEFAULT_MAX_NEARBY_PLAYERS = 8;
const DEFAULT_MAX_NEARBY_GROUND_ITEMS = 12;
const DEFAULT_MAX_NEARBY_OBJECTS = 16;
const DEFAULT_MAX_RECENT_EVENTS = 12;

type RecentEventReader = {
    getRecentForPlayer(player: Pick<PlayerState, "name">): AgentPerceptionEvent[];
};

export interface BotSdkPerceptionBuilderDeps {
    services: () => ServerServices;
    recentEvents?: RecentEventReader;
    radius?: number;
    maxNearbyNpcs?: number;
    maxNearbyPlayers?: number;
    maxNearbyGroundItems?: number;
    maxNearbyObjects?: number;
    maxRecentEvents?: number;
}

type ObjectOverlayCandidate = {
    placement?: LocTilePlacement;
    object?: AgentPerceptionObject;
};

function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function footprintChebyshevDistance(
    px: number,
    py: number,
    tx: number,
    ty: number,
    size: number,
): number {
    const footprint = Math.max(1, size | 0);
    const minX = tx;
    const minY = ty;
    const maxX = minX + footprint - 1;
    const maxY = minY + footprint - 1;

    let dx = 0;
    if (px < minX) dx = minX - px;
    else if (px > maxX) dx = px - maxX;

    let dy = 0;
    if (py < minY) dy = minY - py;
    else if (py > maxY) dy = py - maxY;

    return Math.max(dx, dy);
}

function isMeaningfulName(name: string | undefined): name is string {
    const trimmed = name?.trim();
    return !!trimmed && trimmed.toLowerCase() !== "null";
}

function sanitizeActions(actions: Array<string | null | undefined> | undefined): string[] {
    if (!Array.isArray(actions)) return [];
    const out: string[] = [];
    for (const action of actions) {
        const trimmed = action?.trim();
        if (!trimmed || trimmed.toLowerCase() === "hidden") continue;
        out.push(trimmed);
    }
    return out;
}

function objectKey(object: Pick<AgentPerceptionObject, "locId" | "x" | "z" | "type" | "rotation">): string {
    return `${object.x}:${object.z}:${object.locId}:${object.type}:${object.rotation}`;
}

export class BotSdkPerceptionBuilder {
    private readonly radius: number;
    private readonly maxNearbyNpcs: number;
    private readonly maxNearbyPlayers: number;
    private readonly maxNearbyGroundItems: number;
    private readonly maxNearbyObjects: number;
    private readonly maxRecentEvents: number;

    constructor(private readonly deps: BotSdkPerceptionBuilderDeps) {
        this.radius = Math.max(1, deps.radius ?? DEFAULT_PERCEPTION_RADIUS);
        this.maxNearbyNpcs = Math.max(1, deps.maxNearbyNpcs ?? DEFAULT_MAX_NEARBY_NPCS);
        this.maxNearbyPlayers = Math.max(1, deps.maxNearbyPlayers ?? DEFAULT_MAX_NEARBY_PLAYERS);
        this.maxNearbyGroundItems = Math.max(
            1,
            deps.maxNearbyGroundItems ?? DEFAULT_MAX_NEARBY_GROUND_ITEMS,
        );
        this.maxNearbyObjects = Math.max(1, deps.maxNearbyObjects ?? DEFAULT_MAX_NEARBY_OBJECTS);
        this.maxRecentEvents = Math.max(1, deps.maxRecentEvents ?? DEFAULT_MAX_RECENT_EVENTS);
    }

    build(player: PlayerState, currentTick: number): AgentPerceptionSnapshot {
        const services = this.deps.services();
        return {
            tick: currentTick,
            self: this.buildSelf(player, services),
            skills: this.buildSkills(player),
            inventory: this.buildInventory(player, services),
            equipment: this.buildEquipment(player, services),
            nearbyNpcs: this.buildNearbyNpcs(player, currentTick, services),
            nearbyPlayers: this.buildNearbyPlayers(player, services),
            nearbyGroundItems: this.buildNearbyGroundItems(player, currentTick, services),
            nearbyObjects: this.buildNearbyObjects(player, services),
            recentEvents: this.buildRecentEvents(player),
        };
    }

    private buildSelf(player: PlayerState, services: ServerServices): AgentPerceptionSelf {
        const hp = player.skillSystem.getHitpointsCurrent();
        const maxHp = player.skillSystem.getHitpointsMax();
        return {
            id: player.id,
            name: player.name ?? "",
            combatLevel: player.skillSystem.combatLevel,
            hp,
            maxHp,
            x: player.tileX,
            z: player.tileY,
            level: player.level,
            runEnergy: player.energy.getRunEnergyPercent(),
            specialEnergy: player.specEnergy.getPercent(),
            specialAttackActive: player.specEnergy.isActivated(),
            activePrayers: [...player.prayer.getActivePrayers()].map(String).sort(),
            quickPrayersEnabled: player.prayer.areQuickPrayersEnabled(),
            accountStage: player.account.accountStage,
            worldViewId: player.worldViewId,
            inCombat: player.combat.isAttacking() || player.isBeingAttacked(),
            target: this.buildTarget(player, services),
        };
    }

    private buildTarget(
        player: PlayerState,
        services: ServerServices,
    ): AgentPerceptionSelf["target"] | undefined {
        const target = player.combat.getCombatTarget();
        if (!target) return undefined;

        if (!("typeId" in target)) {
            const resolved = services.players?.getById(target.id);
            return {
                kind: "player",
                id: target.id,
                name: resolved?.name,
                x: target.tileX,
                z: target.tileY,
                level: target.level,
            };
        }

        const npcType = services.npcManager?.getNpcType(target.id);
        return {
            kind: "npc",
            id: target.id,
            name: this.resolveNpcName(target.name, npcType?.name, target.typeId),
            x: target.tileX,
            z: target.tileY,
            level: target.level,
        };
    }

    private buildSkills(player: PlayerState): AgentPerceptionSkill[] {
        const out: AgentPerceptionSkill[] = [];
        for (const id of SKILL_IDS) {
            const entry = player.skillSystem.getSkill(id);
            if (!entry) continue;
            const level = entry.baseLevel + (entry.boost ?? 0);
            out.push({
                id,
                name: SKILL_NAME[id] ?? `skill_${id}`,
                level,
                baseLevel: entry.baseLevel,
                xp: entry.xp,
            });
        }
        return out;
    }

    private buildInventory(
        player: PlayerState,
        services: ServerServices,
    ): AgentPerceptionInventoryItem[] {
        const out: AgentPerceptionInventoryItem[] = [];
        const entries = player.items.getInventoryEntries();
        for (let slot = 0; slot < entries.length; slot++) {
            const entry = entries[slot];
            if (!entry || entry.itemId <= 0 || entry.quantity <= 0) continue;
            out.push({
                slot,
                itemId: entry.itemId,
                name: this.resolveItemName(entry.itemId, services),
                count: entry.quantity,
            });
        }
        return out;
    }

    private buildEquipment(
        player: PlayerState,
        services: ServerServices,
    ): AgentPerceptionInventoryItem[] {
        return player.exportEquipmentSnapshot().map((entry) => ({
            slot: entry.slot,
            itemId: entry.itemId,
            name: this.resolveItemName(entry.itemId, services),
            count: Math.max(1, entry.quantity ?? 1),
        }));
    }

    private buildNearbyPlayers(
        player: PlayerState,
        services: ServerServices,
    ): AgentPerceptionPlayer[] {
        const nearby: AgentPerceptionPlayer[] = [];
        for (const other of services.players?.getAllPlayersForSync() ?? []) {
            if (other.id === player.id) continue;
            if (other.level !== player.level) continue;
            if ((other.worldViewId ?? -1) !== (player.worldViewId ?? -1)) continue;
            const distance = chebyshevDistance(player.tileX, player.tileY, other.tileX, other.tileY);
            if (distance > this.radius) continue;
            nearby.push({
                id: other.id,
                name: other.name ?? "",
                x: other.tileX,
                z: other.tileY,
                level: other.level,
                distance,
                combatLevel: other.skillSystem.combatLevel,
                inCombat: other.combat.isAttacking() || other.isBeingAttacked(),
                isAgent: !!other.agent,
            });
        }
        nearby.sort(
            (a, b) =>
                a.distance - b.distance ||
                a.id - b.id ||
                a.name.localeCompare(b.name),
        );
        return nearby.slice(0, this.maxNearbyPlayers);
    }

    private buildNearbyNpcs(
        player: PlayerState,
        currentTick: number,
        services: ServerServices,
    ): AgentPerceptionNpc[] {
        const nearby: AgentPerceptionNpc[] = [];
        for (const npc of services.npcManager?.getNearby(player.tileX, player.tileY, player.level, this.radius) ??
            []) {
            if ((npc.worldViewId ?? -1) !== (player.worldViewId ?? -1)) continue;
            const type = services.npcManager?.getNpcType(npc);
            const actions = sanitizeActions(type?.actions);
            nearby.push({
                id: npc.id,
                defId: npc.typeId,
                name: this.resolveNpcName(npc.name, type?.name, npc.typeId),
                x: npc.tileX,
                z: npc.tileY,
                level: npc.level,
                distance: footprintChebyshevDistance(
                    player.tileX,
                    player.tileY,
                    npc.tileX,
                    npc.tileY,
                    npc.size,
                ),
                hp: npc.getHitpoints(),
                combatLevel: npc.getCombatLevel() || undefined,
                inCombat: npc.isInCombat(currentTick),
                actions: actions.length > 0 ? actions : undefined,
            });
        }
        nearby.sort(
            (a, b) =>
                a.distance - b.distance ||
                a.id - b.id ||
                a.defId - b.defId ||
                a.name.localeCompare(b.name),
        );
        return nearby.slice(0, this.maxNearbyNpcs);
    }

    private buildNearbyGroundItems(
        player: PlayerState,
        currentTick: number,
        services: ServerServices,
    ): AgentPerceptionGroundItem[] {
        const nearby: AgentPerceptionGroundItem[] = [];
        for (const stack of services.groundItems.queryArea(
            player.tileX,
            player.tileY,
            player.level,
            this.radius,
            currentTick,
            player.id,
            player.worldViewId,
        )) {
            const distance = chebyshevDistance(
                player.tileX,
                player.tileY,
                stack.tile.x,
                stack.tile.y,
            );
            nearby.push({
                itemId: stack.itemId,
                name: this.resolveItemName(stack.itemId, services),
                x: stack.tile.x,
                z: stack.tile.y,
                level: stack.tile.level,
                distance,
                count: stack.quantity,
            });
        }
        nearby.sort(
            (a, b) =>
                a.distance - b.distance ||
                a.itemId - b.itemId ||
                a.name.localeCompare(b.name) ||
                a.x - b.x ||
                a.z - b.z,
        );
        return nearby.slice(0, this.maxNearbyGroundItems);
    }

    private buildNearbyObjects(
        player: PlayerState,
        services: ServerServices,
    ): AgentPerceptionObject[] {
        if ((player.worldViewId ?? -1) !== -1) {
            return [];
        }
        const locTileLookup = services.locTileLookup;
        if (!locTileLookup) {
            return [];
        }

        const objects = new Map<string, AgentPerceptionObject>();
        for (let x = player.tileX - this.radius; x <= player.tileX + this.radius; x++) {
            for (let y = player.tileY - this.radius; y <= player.tileY + this.radius; y++) {
                for (const placement of locTileLookup.getLocsAtTile(player.level, x, y)) {
                    const next = this.resolveObjectFromPlacement(player, placement, services);
                    if (!next) continue;
                    objects.set(objectKey(next), next);
                }
            }
        }

        const sceneBaseX = player.tileX - this.radius;
        const sceneBaseY = player.tileY - this.radius;
        const sceneSize = this.radius * 2 + 1;
        for (const change of services.dynamicLocState.queryScene(
            sceneBaseX,
            sceneBaseY,
            player.level,
            sceneSize,
        )) {
            this.applyDynamicObjectChange(player, change, services, objects);
        }

        const out = [...objects.values()];
        out.sort(
            (a, b) =>
                a.distance - b.distance ||
                a.locId - b.locId ||
                a.name.localeCompare(b.name) ||
                a.x - b.x ||
                a.z - b.z ||
                a.type - b.type ||
                a.rotation - b.rotation,
        );
        return out.slice(0, this.maxNearbyObjects);
    }

    private applyDynamicObjectChange(
        player: PlayerState,
        change: DynamicLocChangeState,
        services: ServerServices,
        objects: Map<string, AgentPerceptionObject>,
    ): void {
        const removed = this.removeMatchingObject(objects, change);
        if (!(change.newId > 0)) return;

        const candidate = this.resolveOverlayCandidate(change, removed, services);
        const next = this.resolveObjectFromPlacement(
            player,
            {
                id: change.newId,
                x: change.newTile.x,
                y: change.newTile.y,
                level: change.level,
                type: change.newShape ?? candidate.placement?.type ?? removed?.type ?? 10,
                rotation:
                    (change.newRotation ??
                        candidate.placement?.rotation ??
                        removed?.rotation ??
                        0) & 0x3,
            },
            services,
        );
        if (!next) return;
        objects.set(objectKey(next), next);
    }

    private removeMatchingObject(
        objects: Map<string, AgentPerceptionObject>,
        change: DynamicLocChangeState,
    ): AgentPerceptionObject | undefined {
        let matched: AgentPerceptionObject | undefined;
        for (const [key, object] of objects.entries()) {
            if (object.x !== change.oldTile.x || object.z !== change.oldTile.y) continue;
            if (object.locId !== change.oldId) continue;
            if (
                change.oldRotation !== undefined &&
                (object.rotation & 0x3) !== (change.oldRotation & 0x3)
            ) {
                continue;
            }
            matched = object;
            objects.delete(key);
            break;
        }
        return matched;
    }

    private resolveOverlayCandidate(
        change: DynamicLocChangeState,
        removed: AgentPerceptionObject | undefined,
        services: ServerServices,
    ): ObjectOverlayCandidate {
        const locTileLookup = services.locTileLookup;
        const placementFromNewTile = locTileLookup?.getLocAt(
            change.level,
            change.newTile.x,
            change.newTile.y,
            change.newId,
        );
        if (placementFromNewTile) {
            return { placement: placementFromNewTile, object: removed };
        }

        const placementFromOldTile = locTileLookup?.getLocAt(
            change.level,
            change.oldTile.x,
            change.oldTile.y,
            change.oldId,
        );
        if (placementFromOldTile) {
            return { placement: placementFromOldTile, object: removed };
        }

        return { object: removed };
    }

    private resolveObjectFromPlacement(
        player: PlayerState,
        placement: LocTilePlacement,
        services: ServerServices,
    ): AgentPerceptionObject | undefined {
        const locType = services.dataLoaderService.getLocDefinition(placement.id);
        const actions = sanitizeActions(locType?.actions);
        const name = this.resolveLocName(placement.id, locType?.name);
        const isNotable =
            (isMeaningfulName(name) && actions.length > 0) ||
            (locType?.isInteractive ?? -1) > 0;
        if (!isNotable) return undefined;

        return {
            locId: placement.id,
            name,
            x: placement.x,
            z: placement.y,
            type: placement.type,
            rotation: placement.rotation & 0x3,
            distance: chebyshevDistance(player.tileX, player.tileY, placement.x, placement.y),
            actions: actions.length > 0 ? actions : undefined,
        };
    }

    private buildRecentEvents(player: PlayerState): AgentPerceptionEvent[] {
        const recent = this.deps.recentEvents?.getRecentForPlayer(player) ?? [];
        if (recent.length <= this.maxRecentEvents) {
            return recent;
        }
        return recent.slice(recent.length - this.maxRecentEvents);
    }

    private resolveItemName(itemId: number, services: ServerServices): string {
        const cacheName = services.dataLoaderService.getObjType(itemId)?.name;
        if (isMeaningfulName(cacheName)) {
            return cacheName.trim();
        }
        const dataName = getItemDefinition(itemId)?.name;
        if (isMeaningfulName(dataName)) {
            return dataName.trim();
        }
        return `item_${itemId}`;
    }

    private resolveNpcName(
        liveName: string | undefined,
        cacheName: string | undefined,
        npcTypeId: number,
    ): string {
        if (isMeaningfulName(liveName)) {
            return liveName.trim();
        }
        if (isMeaningfulName(cacheName)) {
            return cacheName.trim();
        }
        return `npc_${npcTypeId}`;
    }

    private resolveLocName(locId: number, cacheName: string | undefined): string {
        if (isMeaningfulName(cacheName)) {
            return cacheName.trim();
        }
        return `loc_${locId}`;
    }
}
