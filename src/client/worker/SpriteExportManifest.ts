import type { CacheType } from "../../rs/cache/CacheType";
import type { CacheInfo } from "../../rs/cache/CacheInfo";
import type { CacheIndex } from "../../rs/cache/CacheIndex";
import { CacheSystem } from "../../rs/cache/CacheSystem";
import { ConfigType } from "../../rs/cache/ConfigType";
import { IndexType } from "../../rs/cache/IndexType";
import { getPlayerTypeInfo } from "../../rs/chat/PlayerType";
import { GraphicsDefaults } from "../../rs/config/defaults/GraphicsDefaults";
import { ArchiveHealthBarDefinitionLoader } from "../../rs/config/healthbar/HealthBarDefinitionLoader";
import { ArchiveHitSplatTypeLoader } from "../../rs/config/hitsplat/HitSplatTypeLoader";
import { ArchiveMapElementTypeLoader } from "../../rs/config/meltype/MapElementTypeLoader";
import { MapSceneTypeLoader } from "../../rs/config/mapscenetype/MapSceneTypeLoader";
import { PRAYER_DEFINITIONS } from "../../rs/prayer/prayers";

type GraphicsDefaultKey = keyof typeof GRAPHICS_DEFAULT_LABELS;

const GRAPHICS_DEFAULT_LABELS = {
    compass: "Compass",
    mapEdge: "Map edge",
    mapScenes: "Map scenes",
    mapFunctions: "Map functions",
    headIconsPk: "PK head icons",
    headIconsPrayer: "Prayer head icons",
    headIconsHint: "Hint head icons",
    mapMarkers: "Map markers",
    crosses: "Crosses",
    mapDots: "Map dots",
    scrollBars: "Scroll bars",
    modIcons: "Moderator icons",
} as const;

const PLAYER_TYPE_LABELS: Record<number, string> = {
    1: "Player moderator",
    2: "Jagex moderator",
    3: "Ironman",
    4: "Ultimate Ironman",
    5: "Hardcore Ironman",
    6: "League world",
    7: "Group Ironman",
    8: "Hardcore Group Ironman",
    9: "Unranked Group Ironman",
};

export type SpriteExportReference = {
    source: string;
    label: string;
    detail?: string;
};

export type SpriteExportImageMetadata = {
    exportedWidth: number;
    exportedHeight: number;
    sourceSubWidth: number;
    sourceSubHeight: number;
    xOffset: number;
    yOffset: number;
};

export type SpriteExportEntry = {
    path: string;
    archiveId: number;
    frameIndex: number;
    frameCount: number;
    primaryLabel?: string;
    labels: string[];
    references: SpriteExportReference[];
    image: SpriteExportImageMetadata;
};

export type SpriteExportManifest = {
    format: "scape.sprite-export.v1";
    generatedAt: string;
    cache: {
        name: string;
        game: CacheInfo["game"];
        environment: string;
        revision: number;
        type: CacheType;
    };
    spriteCount: number;
    sprites: SpriteExportEntry[];
};

type SpriteReferenceBucket = {
    archive: SpriteExportReference[];
    frames: Map<number, SpriteExportReference[]>;
};

export type SpriteReferenceIndex = Map<number, SpriteReferenceBucket>;

export type SpriteReferenceSources = {
    graphicsDefaults?: Partial<Record<GraphicsDefaultKey, number>>;
    prayers?: Array<{ id: string; name: string; on: number; off: number }>;
    playerTypes?: Array<{ id: number; modIcon: number; name?: string }>;
    mapElements?: Array<{
        id: number;
        name?: string;
        spriteId: number;
        hoverSpriteId: number;
        ops?: (string | undefined)[];
    }>;
    healthBars?: Array<{
        id: number;
        frontSpriteId: number;
        backSpriteId: number;
        width: number;
    }>;
    hitSplats?: Array<{
        id: number;
        leftSpriteId: number;
        leftSpriteId2: number;
        middleSpriteId: number;
        rightSpriteId: number;
        iconSpriteId: number;
    }>;
    mapScenes?: Array<{
        id: number;
        spriteId: number;
    }>;
};

export function createSpriteReferenceIndex(): SpriteReferenceIndex {
    return new Map();
}

export function addSpriteReference(
    index: SpriteReferenceIndex,
    archiveId: number,
    reference: SpriteExportReference,
    frameIndex?: number,
): void {
    if (archiveId < 0) {
        return;
    }

    let bucket = index.get(archiveId);
    if (!bucket) {
        bucket = {
            archive: [],
            frames: new Map(),
        };
        index.set(archiveId, bucket);
    }

    if (frameIndex === undefined || frameIndex < 0) {
        bucket.archive.push(reference);
        return;
    }

    const frameReferences = bucket.frames.get(frameIndex) ?? [];
    frameReferences.push(reference);
    bucket.frames.set(frameIndex, frameReferences);
}

export function getSpriteReferences(
    index: SpriteReferenceIndex,
    archiveId: number,
    frameIndex: number,
): SpriteExportReference[] {
    const bucket = index.get(archiveId);
    if (!bucket) {
        return [];
    }

    const seen = new Set<string>();
    const references = [...(bucket.frames.get(frameIndex) ?? []), ...bucket.archive];

    return references.filter((reference) => {
        const key = `${reference.source}|${reference.label}|${reference.detail ?? ""}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export function getSpriteExportPath(
    archiveId: number,
    frameIndex: number,
    frameCount: number,
): string {
    return frameCount > 1 ? `${archiveId}/${frameIndex}.png` : `${archiveId}.png`;
}

export function buildSpriteManifestEntry(
    archiveId: number,
    frameIndex: number,
    frameCount: number,
    image: SpriteExportImageMetadata,
    referenceIndex: SpriteReferenceIndex,
): SpriteExportEntry {
    const references = getSpriteReferences(referenceIndex, archiveId, frameIndex);
    const labels = Array.from(new Set(references.map((reference) => reference.label)));

    return {
        path: getSpriteExportPath(archiveId, frameIndex, frameCount),
        archiveId,
        frameIndex,
        frameCount,
        primaryLabel: labels[0],
        labels,
        references,
        image,
    };
}

export function buildSpriteExportManifest(
    cacheInfo: CacheInfo,
    cacheType: CacheType,
    entries: SpriteExportEntry[],
    generatedAt: string = new Date().toISOString(),
): SpriteExportManifest {
    const sprites = [...entries].sort(
        (a, b) =>
            a.archiveId - b.archiveId ||
            a.frameIndex - b.frameIndex ||
            a.path.localeCompare(b.path),
    );

    return {
        format: "scape.sprite-export.v1",
        generatedAt,
        cache: {
            name: cacheInfo.name,
            game: cacheInfo.game,
            environment: cacheInfo.environment,
            revision: cacheInfo.revision,
            type: cacheType,
        },
        spriteCount: sprites.length,
        sprites,
    };
}

export function buildSpriteReferenceIndexFromSources(
    sources: SpriteReferenceSources,
): SpriteReferenceIndex {
    const index = createSpriteReferenceIndex();
    const graphicsDefaults = sources.graphicsDefaults ?? {};

    for (const [key, archiveId] of Object.entries(graphicsDefaults) as Array<
        [GraphicsDefaultKey, number | undefined]
    >) {
        if (archiveId === undefined || archiveId < 0) {
            continue;
        }
        addSpriteReference(index, archiveId, {
            source: "graphicsDefaults",
            label: GRAPHICS_DEFAULT_LABELS[key],
            detail: `graphicsDefaults.${key}`,
        });
    }

    const headIconsPrayerArchiveId = graphicsDefaults.headIconsPrayer ?? -1;
    if (headIconsPrayerArchiveId >= 0) {
        for (const prayer of sources.prayers ?? []) {
            if (prayer.on >= 0) {
                addSpriteReference(
                    index,
                    headIconsPrayerArchiveId,
                    {
                        source: "prayer",
                        label: `${prayer.name} (on)`,
                        detail: prayer.id,
                    },
                    prayer.on,
                );
            }
            if (prayer.off >= 0) {
                addSpriteReference(
                    index,
                    headIconsPrayerArchiveId,
                    {
                        source: "prayer",
                        label: `${prayer.name} (off)`,
                        detail: prayer.id,
                    },
                    prayer.off,
                );
            }
        }
    }

    const modIconsArchiveId = graphicsDefaults.modIcons ?? -1;
    if (modIconsArchiveId >= 0) {
        for (const playerType of sources.playerTypes ?? []) {
            if (playerType.modIcon < 0) {
                continue;
            }
            addSpriteReference(
                index,
                modIconsArchiveId,
                {
                    source: "playerType",
                    label: playerType.name ?? `Player type ${playerType.id} mod icon`,
                    detail: `playerType=${playerType.id}`,
                },
                playerType.modIcon,
            );
        }
    }

    const mapFunctionsArchiveId = graphicsDefaults.mapFunctions ?? -1;
    if (mapFunctionsArchiveId >= 0) {
        for (const mapElement of sources.mapElements ?? []) {
            const ops = mapElement.ops?.filter(Boolean).join(", ");
            const baseLabel = mapElement.name?.trim() || `Map element ${mapElement.id}`;
            const detail = ops
                ? `mapElement=${mapElement.id}; ops=${ops}`
                : `mapElement=${mapElement.id}`;
            if (mapElement.spriteId >= 0) {
                addSpriteReference(
                    index,
                    mapFunctionsArchiveId,
                    {
                        source: "mapElement",
                        label: baseLabel,
                        detail,
                    },
                    mapElement.spriteId,
                );
            }
            if (mapElement.hoverSpriteId >= 0) {
                addSpriteReference(
                    index,
                    mapFunctionsArchiveId,
                    {
                        source: "mapElement",
                        label: `${baseLabel} (hover)`,
                        detail,
                    },
                    mapElement.hoverSpriteId,
                );
            }
        }
    }

    for (const healthBar of sources.healthBars ?? []) {
        if (healthBar.frontSpriteId >= 0) {
            addSpriteReference(index, healthBar.frontSpriteId, {
                source: "healthBar",
                label: `Health bar ${healthBar.id} front`,
                detail: `healthBar=${healthBar.id}; width=${healthBar.width}`,
            });
        }
        if (healthBar.backSpriteId >= 0) {
            addSpriteReference(index, healthBar.backSpriteId, {
                source: "healthBar",
                label: `Health bar ${healthBar.id} back`,
                detail: `healthBar=${healthBar.id}; width=${healthBar.width}`,
            });
        }
    }

    for (const hitSplat of sources.hitSplats ?? []) {
        addHitSplatPartReference(index, hitSplat.leftSpriteId, hitSplat.id, "left");
        addHitSplatPartReference(index, hitSplat.leftSpriteId2, hitSplat.id, "left alt");
        addHitSplatPartReference(index, hitSplat.middleSpriteId, hitSplat.id, "middle");
        addHitSplatPartReference(index, hitSplat.rightSpriteId, hitSplat.id, "right");
        addHitSplatPartReference(index, hitSplat.iconSpriteId, hitSplat.id, "icon");
    }

    const mapScenesArchiveId = graphicsDefaults.mapScenes ?? -1;
    if (mapScenesArchiveId >= 0) {
        for (const mapScene of sources.mapScenes ?? []) {
            if (mapScene.spriteId < 0) {
                continue;
            }
            addSpriteReference(
                index,
                mapScenesArchiveId,
                {
                    source: "mapScene",
                    label: `Map scene ${mapScene.id}`,
                    detail: `mapScene=${mapScene.id}`,
                },
                mapScene.spriteId,
            );
        }
    }

    return index;
}

export function buildSpriteReferenceIndex(
    cacheInfo: CacheInfo,
    cacheSystem: CacheSystem,
): SpriteReferenceIndex {
    return buildSpriteReferenceIndexFromSources(loadSpriteReferenceSources(cacheInfo, cacheSystem));
}

function addHitSplatPartReference(
    index: SpriteReferenceIndex,
    archiveId: number,
    hitSplatId: number,
    part: string,
): void {
    if (archiveId < 0) {
        return;
    }
    addSpriteReference(index, archiveId, {
        source: "hitSplat",
        label: `Hitsplat ${hitSplatId} ${part}`,
        detail: `hitSplat=${hitSplatId}`,
    });
}

function loadSpriteReferenceSources(
    cacheInfo: CacheInfo,
    cacheSystem: CacheSystem,
): SpriteReferenceSources {
    const graphicsDefaults = tryLoadGraphicsDefaults(cacheInfo, cacheSystem);
    const configIndex = cacheSystem.indexExists(IndexType.DAT2.configs)
        ? cacheSystem.getIndex(IndexType.DAT2.configs)
        : undefined;

    return {
        graphicsDefaults,
        prayers: PRAYER_DEFINITIONS.map((prayer) => ({
            id: prayer.id,
            name: prayer.name,
            on: prayer.spriteOnId,
            off: prayer.spriteOffId,
        })),
        playerTypes: loadPlayerTypeReferences(),
        mapElements: configIndex ? loadMapElementReferences(cacheInfo, configIndex) : [],
        healthBars: configIndex ? loadHealthBarReferences(cacheInfo, configIndex) : [],
        hitSplats: configIndex ? loadHitSplatReferences(cacheInfo, configIndex) : [],
        mapScenes: configIndex ? loadMapSceneReferences(cacheInfo, configIndex) : [],
    };
}

function tryLoadGraphicsDefaults(
    cacheInfo: CacheInfo,
    cacheSystem: CacheSystem,
): Partial<Record<GraphicsDefaultKey, number>> | undefined {
    try {
        const defaults = GraphicsDefaults.load(cacheInfo, cacheSystem);
        return {
            compass: defaults.compass,
            mapEdge: defaults.mapEdge,
            mapScenes: defaults.mapScenes,
            mapFunctions: defaults.mapFunctions,
            headIconsPk: defaults.headIconsPk,
            headIconsPrayer: defaults.headIconsPrayer,
            headIconsHint: defaults.headIconsHint,
            mapMarkers: defaults.mapMarkers,
            crosses: defaults.crosses,
            mapDots: defaults.mapDots,
            scrollBars: defaults.scrollBars,
            modIcons: defaults.modIcons,
        };
    } catch (error) {
        console.warn("Failed to load graphics defaults for sprite export", error);
        return undefined;
    }
}

function loadPlayerTypeReferences(): Array<{ id: number; modIcon: number; name?: string }> {
    const playerTypes: Array<{ id: number; modIcon: number; name?: string }> = [];

    for (let id = 0; id <= 64; id++) {
        const info = getPlayerTypeInfo(id);
        if (!info || info.modIcon < 0) {
            continue;
        }
        playerTypes.push({
            id,
            modIcon: info.modIcon,
            name: PLAYER_TYPE_LABELS[id] ?? `Player type ${id} mod icon`,
        });
    }

    return playerTypes;
}

function loadMapElementReferences(cacheInfo: CacheInfo, configIndex: CacheIndex) {
    const archiveId = getExistingArchiveId(configIndex, [
        ConfigType.OSRS.mapFunctions,
        ConfigType.RS2.mapFunctions,
    ]);
    if (archiveId === undefined) {
        return [];
    }

    const archive = configIndex.getArchive(archiveId);
    const loader = new ArchiveMapElementTypeLoader(cacheInfo, archive);

    return Array.from(archive.fileIds, (fileId) => {
        const mapElement = loader.load(fileId);
        return {
            id: fileId,
            name: mapElement.name,
            spriteId: mapElement.spriteId,
            hoverSpriteId: mapElement.hoverSpriteId,
            ops: mapElement.ops,
        };
    });
}

function loadHealthBarReferences(cacheInfo: CacheInfo, configIndex: CacheIndex) {
    if (!configIndex.archiveExists(ConfigType.OSRS.healthBar)) {
        return [];
    }

    const archive = configIndex.getArchive(ConfigType.OSRS.healthBar);
    const loader = new ArchiveHealthBarDefinitionLoader(cacheInfo, archive);

    return Array.from(archive.fileIds, (fileId) => {
        const definition = loader.load(fileId);
        return {
            id: fileId,
            frontSpriteId: definition.frontSpriteId,
            backSpriteId: definition.backSpriteId,
            width: definition.width,
        };
    });
}

function loadHitSplatReferences(cacheInfo: CacheInfo, configIndex: CacheIndex) {
    if (!configIndex.archiveExists(ConfigType.OSRS.hitSplat)) {
        return [];
    }

    const archive = configIndex.getArchive(ConfigType.OSRS.hitSplat);
    const loader = new ArchiveHitSplatTypeLoader(cacheInfo, archive);

    return Array.from(archive.fileIds, (fileId) => {
        const definition = loader.load(fileId);
        return {
            id: fileId,
            leftSpriteId: definition.leftSpriteId,
            leftSpriteId2: definition.leftSpriteId2,
            middleSpriteId: definition.middleSpriteId,
            rightSpriteId: definition.rightSpriteId,
            iconSpriteId: definition.iconSpriteId,
        };
    });
}

function loadMapSceneReferences(cacheInfo: CacheInfo, configIndex: CacheIndex) {
    if (!configIndex.archiveExists(ConfigType.RS2.mapScenes)) {
        return [];
    }

    const archive = configIndex.getArchive(ConfigType.RS2.mapScenes);
    const loader = new MapSceneTypeLoader(cacheInfo, archive);

    return Array.from(archive.fileIds, (fileId) => {
        const definition = loader.load(fileId);
        return {
            id: fileId,
            spriteId: definition.spriteId,
        };
    });
}

function getExistingArchiveId(configIndex: CacheIndex, archiveIds: number[]): number | undefined {
    return archiveIds.find((archiveId) => configIndex.archiveExists(archiveId));
}
