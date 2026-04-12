import { afterEach, describe, expect, test } from "bun:test";

const ORIGINAL_CACHE_BASE_URL = process.env.REACT_APP_CACHE_BASE_URL;
const ORIGINAL_MAP_IMAGE_BASE_URL = process.env.REACT_APP_MAP_IMAGE_BASE_URL;

function restoreEnv() {
    if (ORIGINAL_CACHE_BASE_URL === undefined) {
        delete process.env.REACT_APP_CACHE_BASE_URL;
    } else {
        process.env.REACT_APP_CACHE_BASE_URL = ORIGINAL_CACHE_BASE_URL;
    }

    if (ORIGINAL_MAP_IMAGE_BASE_URL === undefined) {
        delete process.env.REACT_APP_MAP_IMAGE_BASE_URL;
    } else {
        process.env.REACT_APP_MAP_IMAGE_BASE_URL = ORIGINAL_MAP_IMAGE_BASE_URL;
    }
}

async function loadAssetSources() {
    return import(`../src/client/assetSources?ts=${Date.now()}_${Math.random()}`);
}

afterEach(() => {
    restoreEnv();
});

describe("assetSources", () => {
    test("defaults to same-origin asset paths", async () => {
        delete process.env.REACT_APP_CACHE_BASE_URL;
        delete process.env.REACT_APP_MAP_IMAGE_BASE_URL;

        const assetSources = await loadAssetSources();

        expect(assetSources.CACHE_BASE_URL).toBe("/caches");
        expect(assetSources.MAP_IMAGE_BASE_URL).toBe("/map-images");
        expect(assetSources.getCacheBasePath("osrs-live")).toBe("/caches/osrs-live");
        expect(assetSources.getMapImageBasePath("osrs-live")).toBe("/map-images/osrs-live");
    });

    test("uses explicit CDN base URLs when provided", async () => {
        process.env.REACT_APP_CACHE_BASE_URL = "https://cdn.example.com/caches/";
        process.env.REACT_APP_MAP_IMAGE_BASE_URL = "https://cdn.example.com/map-images/";

        const assetSources = await loadAssetSources();

        expect(assetSources.CACHE_BASE_URL).toBe("https://cdn.example.com/caches");
        expect(assetSources.MAP_IMAGE_BASE_URL).toBe("https://cdn.example.com/map-images");
        expect(assetSources.getCacheBasePath("osrs-live")).toBe(
            "https://cdn.example.com/caches/osrs-live",
        );
        expect(assetSources.getMapImageBasePath("osrs-live")).toBe(
            "https://cdn.example.com/map-images/osrs-live",
        );
    });
});
