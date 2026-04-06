import type { WebSocket } from "ws";

import type { PlayerNetworkLayer } from "../../network/PlayerNetworkLayer";
import type { WorldEntityInfoEncoder } from "../../network/encoding/WorldEntityInfoEncoder";
import type { LocationService } from "./LocationService";
import type { MovementService } from "./MovementService";
import type { PlayerState } from "../player";
import { encodeMessage } from "../../network/messages";
import { buildRebuildNormalPayload, buildRebuildWorldEntityPayload } from "../../world/InstanceManager";
import type { WorldEntityBuildArea } from "../../../../src/shared/worldentity/WorldEntityTypes";
import type { CacheEnv } from "../../world/CacheEnv";
import { logger } from "../../utils/logger";

export interface WorldEntityServiceDeps {
    getSocketByPlayerId: (id: number) => WebSocket | undefined;
    networkLayer: PlayerNetworkLayer;
    worldEntityInfoEncoder: WorldEntityInfoEncoder;
    locationService: LocationService;
    movementService: MovementService;
    cacheEnv: CacheEnv | undefined;
}

export class WorldEntityService {
    private deps: WorldEntityServiceDeps;

    constructor(deps: WorldEntityServiceDeps) {
        this.deps = deps;
    }

    setDeferredDeps(deferred: Partial<WorldEntityServiceDeps>): void {
        Object.assign(this.deps, deferred);
    }

    sendRebuildNormal(player: PlayerState): void {
        const ws = this.deps.getSocketByPlayerId(player.id);
        if (!ws) return;

        const regionX = player.tileX >> 3;
        const regionY = player.tileY >> 3;
        const payload = buildRebuildNormalPayload(
            regionX,
            regionY,
            this.deps.cacheEnv!,
        );
        const packet = encodeMessage({ type: "rebuild_normal", payload } as any);
        this.deps.networkLayer.withDirectSendBypass("rebuild_normal", () =>
            this.deps.networkLayer.sendWithGuard(ws, packet, "rebuild_normal"),
        );
    }

    sendWorldEntity(
        player: PlayerState,
        entityIndex: number,
        configId: number,
        sizeX: number,
        sizeZ: number,
        templateChunks: number[][][],
        buildAreas: WorldEntityBuildArea[],
        extraLocs?: Array<{ id: number; x: number; y: number; level: number; shape: number; rotation: number }>,
        extraNpcs?: Array<{ id: number; x: number; y: number; level: number }>,
        drawMode: number = 0,
    ): void {
        const ws = this.deps.getSocketByPlayerId(player.id);
        if (!ws) return;

        const regionX = 480; // source region chunk X
        const regionY = 800; // source region chunk Y

        const payload = buildRebuildWorldEntityPayload(
            entityIndex, configId, sizeX, sizeZ,
            regionX, regionY, regionX, regionY,
            templateChunks, buildAreas, this.deps.cacheEnv!, false,
        );
        (payload as any).extraNpcs = extraNpcs ?? [];
        // Pass basePlane so the client knows which plane deck content lives on
        (payload as any).basePlane = 1;
        const packet = encodeMessage({ type: "rebuild_worldentity", payload } as any);
        this.deps.networkLayer.withDirectSendBypass("rebuild_worldentity", () =>
            this.deps.networkLayer.sendWithGuard(ws, packet, "rebuild_worldentity"),
        );

        // Register in per-tick world entity tracker with initial position (fine units)
        const entityFineX = (regionX * 8 + sizeX * 4) * 128;
        const entityFineZ = (regionY * 8 + sizeZ * 4) * 128;
        this.deps.worldEntityInfoEncoder.addEntity(player.id, {
            entityIndex, sizeX, sizeZ, configId, drawMode,
            position: { x: entityFineX, y: 0, z: entityFineZ, orientation: 0 },
        });

        if (extraLocs) {
            for (const loc of extraLocs) {
                this.deps.locationService.spawnLocForPlayer(player, loc.id, { x: loc.x, y: loc.y }, loc.level, loc.shape, loc.rotation);
            }
        }
    }

    teleportToWorldEntity(
        player: PlayerState,
        x: number,
        y: number,
        level: number,
        entityIndex: number,
        configId: number,
        sizeX: number,
        sizeZ: number,
        templateChunks: number[][][],
        buildAreas: WorldEntityBuildArea[],
        extraLocs?: Array<{ id: number; x: number; y: number; level: number; shape: number; rotation: number }>,
        drawMode: number = 0,
    ): void {
        logger.info(`[teleportToWorldEntity] Player ${player.id} -> (${x}, ${y}, ${level}) entity=${entityIndex}`);
        const ws = this.deps.getSocketByPlayerId(player.id);
        if (!ws) {
            logger.warn(`[teleportToWorldEntity] No websocket for player ${player.id}`);
            return;
        }

        const regionX = x >> 3;
        const regionY = y >> 3;
        const zoneX = regionX;
        const zoneZ = regionY;

        const payload = buildRebuildWorldEntityPayload(
            entityIndex,
            configId,
            sizeX,
            sizeZ,
            zoneX,
            zoneZ,
            regionX,
            regionY,
            templateChunks,
            buildAreas,
            this.deps.cacheEnv!,
            false,
        );
        const packet = encodeMessage({ type: "rebuild_worldentity", payload } as any);
        logger.info(`[teleportToWorldEntity] Sending REBUILD_WORLDENTITY packet (${packet.length} bytes, ${payload.mapRegions.length} regions)`);
        this.deps.networkLayer.withDirectSendBypass("rebuild_worldentity", () =>
            this.deps.networkLayer.sendWithGuard(ws, packet, "rebuild_worldentity"),
        );

        // Register in per-tick world entity tracker with initial position (fine units)
        const entityFineX = (regionX * 8 + sizeX * 4) * 128;
        const entityFineZ = (regionY * 8 + sizeZ * 4) * 128;
        this.deps.worldEntityInfoEncoder.addEntity(player.id, {
            entityIndex, sizeX, sizeZ, configId, drawMode,
            position: { x: entityFineX, y: 0, z: entityFineZ, orientation: 0 },
        });

        this.deps.movementService.teleportPlayer(player, x, y, level);

        if (extraLocs) {
            for (const loc of extraLocs) {
                this.deps.locationService.spawnLocForPlayer(player, loc.id, { x: loc.x, y: loc.y }, loc.level, loc.shape, loc.rotation);
            }
        }
    }
}
