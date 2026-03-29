import type { PlayerState } from "../player";
import type { NpcSpawnConfig, NpcState } from "../npc";
import {
    buildSailingIntroTemplates,
    SAILING_INTRO_BOAT_LOCS,
    SAILING_INTRO_LEVEL,
    SAILING_INTRO_NPC_SPAWNS,
    SAILING_INTRO_X,
    SAILING_INTRO_Y,
    SAILING_WORLD_ENTITY_INDEX,
} from "./SailingInstance";
import { logger } from "../../utils/logger";

// Sailing instance region: source base is (3840, 6400).
// Any player whose saved position falls inside this 8x8 chunk region
// was inside a sailing instance when they logged out.
const INSTANCE_MIN_X = 3840;
const INSTANCE_MAX_X = 3840 + 8 * 13; // template grid covers 13 chunks
const INSTANCE_MIN_Y = 6400;
const INSTANCE_MAX_Y = 6400 + 8 * 13;

export interface SailingInstanceServices {
    teleportToInstance: (
        player: PlayerState,
        x: number,
        y: number,
        level: number,
        templateChunks: number[][][],
        extraLocs?: Array<{ id: number; x: number; y: number; level: number; shape: number; rotation: number }>,
    ) => void;
    spawnNpc: (config: NpcSpawnConfig) => NpcState | undefined;
    removeNpc: (npcId: number) => boolean;
}

export class SailingInstanceManager {
    private readonly services: SailingInstanceServices;

    constructor(services: SailingInstanceServices) {
        this.services = services;
    }

    isInSailingInstanceRegion(player: PlayerState): boolean {
        return (
            player.tileX >= INSTANCE_MIN_X &&
            player.tileX < INSTANCE_MAX_X &&
            player.tileY >= INSTANCE_MIN_Y &&
            player.tileY < INSTANCE_MAX_Y
        );
    }

    initInstance(player: PlayerState): void {
        this.disposeInstance(player);

        const templateChunks = buildSailingIntroTemplates();
        player.worldViewId = SAILING_WORLD_ENTITY_INDEX;
        this.services.teleportToInstance(
            player,
            SAILING_INTRO_X,
            SAILING_INTRO_Y,
            SAILING_INTRO_LEVEL,
            templateChunks,
            SAILING_INTRO_BOAT_LOCS,
        );

        const { willBoat, anneBoat, boatHp } = SAILING_INTRO_NPC_SPAWNS;
        for (const spawn of [willBoat, anneBoat, boatHp]) {
            const npc = this.services.spawnNpc({ ...spawn, wanderRadius: 0 });
            if (npc) {
                npc.worldViewId = SAILING_WORLD_ENTITY_INDEX;
                player.instanceNpcIds.add(npc.id);
            } else {
                logger.warn(
                    `[SailingInstanceManager] Failed to spawn NPC ${spawn.id} for player ${player.id}`,
                );
            }
        }

        const npcIds = [...player.instanceNpcIds].join(", ");
        logger.info(
            `[SailingInstance] Created instance for player ${player.id} — spawned ${player.instanceNpcIds.size} NPCs [${npcIds}]`,
        );
    }

    disposeInstance(player: PlayerState): void {
        player.worldViewId = -1;
        if (player.instanceNpcIds.size === 0) return;

        const npcIds = [...player.instanceNpcIds].join(", ");
        for (const npcId of player.instanceNpcIds) {
            this.services.removeNpc(npcId);
        }

        logger.info(
            `[SailingInstance] Destroyed instance for player ${player.id} — removed ${player.instanceNpcIds.size} NPCs [${npcIds}]`,
        );
        player.instanceNpcIds.clear();
    }
}
