import type { CacheInfo } from "../../rs/cache/CacheInfo";
import type { CacheSystem } from "../../rs/cache/CacheSystem";
import { ConfigType } from "../../rs/cache/ConfigType";
import { IndexType } from "../../rs/cache/IndexType";
import {
    ArchiveEnumTypeLoader,
    IndexEnumTypeLoader,
} from "../../rs/config/enumtype/EnumTypeLoader";

export type EnumData = {
    keys?: number[];
    intValues?: number[];
    strValues?: string[];
};

export const DEFAULT_CACHE_INFO: CacheInfo = {
    name: "osrs",
    game: "oldschool",
    environment: "live",
    revision: 0,
    timestamp: "",
    size: 0,
};

export type EnumCacheContext = {
    canvas?: HTMLCanvasElement;
    backend?: { canvas?: HTMLCanvasElement } | null;
    getCacheSystem?: () => CacheSystem | undefined;
    cacheSystem?: CacheSystem;
};

export function loadEnumCached(
    ctx: EnumCacheContext,
    enumId: number,
    cacheKey: string = `enum_${enumId}`,
): EnumData | undefined {
    const canvas = ctx.canvas ?? (ctx.backend as any)?.canvas;
    const cacheSystem = ctx.cacheSystem ?? ctx.getCacheSystem?.();
    if (!canvas || !cacheSystem) return undefined;

    const ui: any = ((canvas as any).__ui = (canvas as any).__ui || {});
    const store: Record<string, EnumData> = (ui.enumCache = ui.enumCache || {});
    const cached = store[cacheKey];
    if (cached) return cached;

    const loaded = loadEnumFromCacheSystem(cacheSystem, enumId);
    if (loaded) {
        store[cacheKey] = loaded;
    }
    return loaded;
}

function loadEnumFromCacheSystem(cacheSystem: CacheSystem, enumId: number): EnumData | undefined {
    try {
        if (cacheSystem.indexExists(IndexType.RS2.enums)) {
            const enumsIndex = cacheSystem.getIndex(IndexType.RS2.enums);
            const loader = new IndexEnumTypeLoader(DEFAULT_CACHE_INFO, enumsIndex);
            const en = loader.load(enumId) as EnumData;
            if (hasEnumData(en)) return sanitizeEnumData(en);
        }
    } catch {}

    try {
        if (cacheSystem.indexExists(IndexType.DAT2.configs)) {
            const cfg = cacheSystem.getIndex(IndexType.DAT2.configs);
            if (cfg.archiveExists?.(ConfigType.DAT2.enums)) {
                const arch = cfg.getArchive(ConfigType.DAT2.enums);
                if (arch) {
                    const loader = new ArchiveEnumTypeLoader(DEFAULT_CACHE_INFO, arch);
                    const en = loader.load(enumId) as EnumData;
                    if (hasEnumData(en)) return sanitizeEnumData(en);
                }
            }
        }
    } catch {}

    return undefined;
}

function hasEnumData(data: EnumData | undefined): boolean {
    if (!data) return false;
    const keysLength = Array.isArray(data.keys) ? data.keys.length : 0;
    const intLength = Array.isArray(data.intValues) ? data.intValues.length : 0;
    const strLength = Array.isArray((data as any).strValues || (data as any).stringValues)
        ? ((data as any).strValues || (data as any).stringValues).length
        : 0;
    return keysLength > 0 || intLength > 0 || strLength > 0;
}

function sanitizeEnumData(data: EnumData): EnumData {
    return {
        keys: normalizeEnumArray(data.keys),
        intValues: normalizeEnumArray(data.intValues),
        strValues: Array.isArray((data as any).strValues)
            ? ((data as any).strValues as string[])
            : Array.isArray((data as any).stringValues)
            ? ((data as any).stringValues as string[])
            : undefined,
    };
}

export function normalizeEnumArray(value: any): number[] {
    if (Array.isArray(value)) {
        return value.map((num) => Number(num) | 0);
    }
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView?.(value)) {
        return Array.from(value as unknown as ArrayLike<number>, (num) => Number(num) | 0);
    }
    return [];
}

export function normalizePositiveInteger(value: number | null | undefined): number | null {
    if (value == null) return null;
    const numeric = value | 0;
    return numeric > 0 ? numeric : null;
}
