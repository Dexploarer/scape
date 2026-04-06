import { CacheFiles, ProgressListener } from "../rs/cache/CacheFiles";
import { CacheInfo, getLatestCache } from "../rs/cache/CacheInfo";
import { CacheType, detectCacheType } from "../rs/cache/CacheType";
import { IndexType } from "../rs/cache/IndexType";

const CACHE_PATH = "/caches/";

function shouldSkipDat2MainCacheWrite(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const vendor = navigator.vendor || "";
    if (!/Safari/i.test(ua)) return false;
    if (/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox/i.test(ua)) return false;
    return /Apple/i.test(vendor);
}

/** Maps DAT2 index IDs to human-readable names for loading display */
const INDEX_NAMES: Record<number, string> = {
    [IndexType.DAT2.animations]: "animations",
    [IndexType.DAT2.skeletons]: "skeletons",
    [IndexType.DAT2.configs]: "config",
    [IndexType.DAT2.interfaces]: "interfaces",
    [IndexType.DAT2.soundEffects]: "sound effects",
    [IndexType.DAT2.maps]: "maps",
    [IndexType.DAT2.musicTracks]: "music tracks",
    [IndexType.DAT2.models]: "models",
    [IndexType.DAT2.sprites]: "sprites",
    [IndexType.DAT2.textures]: "textures",
    [IndexType.DAT2.binary]: "binary",
    [IndexType.DAT2.musicJingles]: "music jingles",
    [IndexType.DAT2.clientScript]: "scripts",
    [IndexType.DAT2.fonts]: "fonts",
    [IndexType.DAT2.musicSamples]: "music samples",
    [IndexType.DAT2.musicPatches]: "music patches",
    [IndexType.OSRS.animKeyFrames]: "animation keyframes",
};

/** Get display name for an index ID */
export function getIndexName(indexId: number): string {
    const name = INDEX_NAMES[indexId];
    return name !== undefined ? name : `index ${indexId}`;
}

export async function fetchCacheInfos(): Promise<CacheInfo[]> {
    const resp = await fetch(CACHE_PATH + "caches.json");
    return resp.json();
}

export type CacheList = {
    caches: CacheInfo[];
    latest: CacheInfo;
};

export async function fetchCacheList(): Promise<CacheList | undefined> {
    const caches = await fetchCacheInfos();
    const latest = getLatestCache(caches);
    if (!latest) {
        return undefined;
    }
    return {
        caches,
        latest,
    };
}

export type LoadedCache = {
    info: CacheInfo;
    type: CacheType;
    files: CacheFiles;
    xteas: XteaMap;
};

/**
 * Load cache files.
 * @param deferIndices If true, only loads dat2 + meta file. Idx files must be loaded later via loadIndexFile.
 */
export async function loadCacheFiles(
    info: CacheInfo,
    signal?: AbortSignal,
    progressListener?: ProgressListener,
    extraIndexIds?: number[],
    deferIndices: boolean = false,
): Promise<LoadedCache> {
    const cachePath = CACHE_PATH + info.name + "/";

    const xteasPromise = fetchXteas(cachePath + "keys.json", signal);

    const cacheType = detectCacheType(info);
    // Use SharedArrayBuffer only when it's truly available and the context is isolated.
    const useSharedArrayBuffer =
        typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;
    let files: CacheFiles;
    if (cacheType === "dat2") {
        // Safari/WebKit can crash tab processes when writing huge dat2 blobs to CacheStorage.
        // Keep downloading dat2, but skip persisting that one file on Safari for stability.
        const skipDat2MainCacheWrite = shouldSkipDat2MainCacheWrite();
        if (skipDat2MainCacheWrite) {
            console.log(
                "[storage] Safari/WebKit detected: skipping final dat2 cache write to avoid tab crashes; keeping resumable part cache",
            );
        }
        // If deferring indices, only load dat2 + meta (no idx files yet)
        const indicesToLoad = deferIndices ? [] : getRequiredIndexIds(info);
        if (!deferIndices && extraIndexIds && extraIndexIds.length) {
            for (const id of extraIndexIds) if (!indicesToLoad.includes(id)) indicesToLoad.push(id);
        }
        files = await CacheFiles.fetchDat2(
            cachePath,
            info.name,
            indicesToLoad,
            useSharedArrayBuffer,
            signal,
            progressListener,
            undefined, // No sequential loading when deferring - we'll load indices later
            skipDat2MainCacheWrite,
        );
    } else if (cacheType === "dat") {
        files = await CacheFiles.fetchDat(
            cachePath,
            info.name,
            useSharedArrayBuffer,
            signal,
            progressListener,
        );
    } else {
        files = await CacheFiles.fetchLegacy(
            cachePath,
            info.name,
            useSharedArrayBuffer,
            signal,
            progressListener,
        );
    }

    const xteas = await xteasPromise;

    return {
        info,
        type: cacheType,
        files,
        xteas,
    };
}

/**
 * Load a single index file into an existing cache.
 * Used for incremental loading during LOADING phase.
 * Returns the loaded data buffer so it can be added to CacheSystem.
 */
export async function loadIndexFile(
    cache: LoadedCache,
    indexId: number,
    signal?: AbortSignal,
    progressListener?: ProgressListener,
): Promise<ArrayBuffer | null> {
    const cachePath = CACHE_PATH + cache.info.name + "/";
    const useSharedArrayBuffer =
        typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;

    const indexName = getIndexName(indexId);

    // Wrap progress listener to add label
    const labeledListener: ProgressListener | undefined = progressListener
        ? (progress) => {
              progressListener({ ...progress, label: indexName });
          }
        : undefined;

    const indexData = await CacheFiles.fetchSingleIndex(
        cachePath,
        cache.info.name,
        indexId,
        useSharedArrayBuffer,
        signal,
        labeledListener,
    );

    if (indexData) {
        cache.files.addFile(`main_file_cache.idx${indexId}`, indexData);
        return indexData;
    }
    return null;
}

/** Get the list of required index IDs for a cache */
export function getRequiredIndexIds(info: CacheInfo): number[] {
    const ids: number[] = [];
    // Core indices used by renderer and minimap generation
    ids.push(
        IndexType.DAT2.configs,
        IndexType.DAT2.sprites,
        IndexType.DAT2.textures,
        IndexType.DAT2.models,
        IndexType.DAT2.maps,
        IndexType.DAT2.animations,
        IndexType.DAT2.skeletons,
        // public chat uses the Huffman table stored in the binary index (idx10).
        IndexType.DAT2.binary,
        IndexType.DAT2.soundEffects, // For audio playback
        IndexType.DAT2.musicTracks, // Required for MusicSystem + RealtimeMidiSynth
        IndexType.DAT2.musicSamples, // Needed for music patch playback
        IndexType.DAT2.musicPatches, // Needed for music patch playback
        IndexType.DAT2.musicJingles, // Short fanfares; harmless to load
    );
    // OSRS skeletal keyframes (>=229)
    if (info.game === "oldschool" && info.revision >= 229) {
        ids.push(IndexType.OSRS.animKeyFrames);
    }
    // RS newer indices for content types
    if (info.game === "runescape" && info.revision >= 488) {
        ids.push(
            IndexType.RS2.locs,
            IndexType.RS2.npcs,
            IndexType.RS2.objs,
            IndexType.RS2.varbits,
            IndexType.RS2.materials,
        );
    }
    return ids;
}

export type XteaMap = Map<number, number[]>;

export async function fetchXteas(url: RequestInfo, signal?: AbortSignal): Promise<XteaMap> {
    const resp = await fetch(url, {
        signal,
    });
    const data: Record<string, number[]> = await resp.json();
    return new Map(Object.keys(data).map((key) => [parseInt(key), data[key]]));
}
