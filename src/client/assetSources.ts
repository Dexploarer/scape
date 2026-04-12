function readEnv(key: string): string | undefined {
    if (typeof process === "undefined" || !process.env) return undefined;
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
    const base = value ?? fallback;
    return base.endsWith("/") ? base.slice(0, -1) : base;
}

export const CACHE_BASE_URL = normalizeBaseUrl(readEnv("REACT_APP_CACHE_BASE_URL"), "/caches");

export const MAP_IMAGE_BASE_URL = normalizeBaseUrl(
    readEnv("REACT_APP_MAP_IMAGE_BASE_URL"),
    "/map-images",
);

export function getCacheBasePath(cacheName?: string): string {
    return cacheName ? `${CACHE_BASE_URL}/${cacheName}` : CACHE_BASE_URL;
}

export function getMapImageBasePath(cacheName?: string): string {
    return cacheName ? `${MAP_IMAGE_BASE_URL}/${cacheName}` : MAP_IMAGE_BASE_URL;
}
