import { describe, expect, test } from "bun:test";

import type { CacheInfo } from "../src/rs/cache/CacheInfo";
import {
    addSpriteReference,
    buildSpriteExportManifest,
    buildSpriteManifestEntry,
    buildSpriteReferenceIndexFromSources,
    createSpriteReferenceIndex,
    getSpriteExportPath,
    getSpriteReferences,
} from "../src/client/worker/SpriteExportManifest";

const CACHE_INFO: CacheInfo = {
    name: "test-cache",
    game: "oldschool",
    environment: "live",
    revision: 227,
    timestamp: "2026-04-12T00:00:00.000Z",
    size: 1,
};

describe("SpriteExportManifest", () => {
    test("uses the exported zip path layout for single and multi-frame archives", () => {
        expect(getSpriteExportPath(42, 0, 1)).toBe("42.png");
        expect(getSpriteExportPath(42, 7, 8)).toBe("42/7.png");
    });

    test("prefers frame-specific labels before archive labels in manifest entries", () => {
        const index = createSpriteReferenceIndex();
        addSpriteReference(index, 55, {
            source: "graphicsDefaults",
            label: "Prayer head icons",
        });
        addSpriteReference(
            index,
            55,
            {
                source: "prayer",
                label: "Thick Skin (on)",
                detail: "thick_skin",
            },
            3,
        );

        const entry = buildSpriteManifestEntry(
            55,
            3,
            10,
            {
                exportedWidth: 18,
                exportedHeight: 18,
                sourceSubWidth: 16,
                sourceSubHeight: 16,
                xOffset: 1,
                yOffset: 1,
            },
            index,
        );

        expect(entry.path).toBe("55/3.png");
        expect(entry.primaryLabel).toBe("Thick Skin (on)");
        expect(entry.labels).toEqual(["Thick Skin (on)", "Prayer head icons"]);
        expect(entry.image).toEqual({
            exportedWidth: 18,
            exportedHeight: 18,
            sourceSubWidth: 16,
            sourceSubHeight: 16,
            xOffset: 1,
            yOffset: 1,
        });
    });

    test("builds a reference index from cache-derived sprite sources", () => {
        const index = buildSpriteReferenceIndexFromSources({
            graphicsDefaults: {
                headIconsPrayer: 10,
                modIcons: 20,
                mapFunctions: 30,
            },
            prayers: [{ id: "piety", name: "Piety", on: 5, off: 9 }],
            playerTypes: [{ id: 1, modIcon: 0, name: "Player moderator" }],
            mapElements: [
                {
                    id: 17,
                    name: "Bank",
                    spriteId: 7,
                    hoverSpriteId: 8,
                    ops: ["Bank", undefined, "Teleport"],
                },
            ],
            healthBars: [{ id: 2, frontSpriteId: 200, backSpriteId: 201, width: 30 }],
            hitSplats: [
                {
                    id: 4,
                    leftSpriteId: 300,
                    leftSpriteId2: -1,
                    middleSpriteId: 301,
                    rightSpriteId: 302,
                    iconSpriteId: 303,
                },
            ],
        });

        expect(getSpriteReferences(index, 10, 5)).toEqual([
            {
                source: "prayer",
                label: "Piety (on)",
                detail: "piety",
            },
            {
                source: "graphicsDefaults",
                label: "Prayer head icons",
                detail: "graphicsDefaults.headIconsPrayer",
            },
        ]);
        expect(getSpriteReferences(index, 20, 0)).toContainEqual({
            source: "playerType",
            label: "Player moderator",
            detail: "playerType=1",
        });
        expect(getSpriteReferences(index, 30, 7)).toContainEqual({
            source: "mapElement",
            label: "Bank",
            detail: "mapElement=17; ops=Bank, Teleport",
        });
        expect(getSpriteReferences(index, 30, 8)).toContainEqual({
            source: "mapElement",
            label: "Bank (hover)",
            detail: "mapElement=17; ops=Bank, Teleport",
        });
        expect(getSpriteReferences(index, 200, 0)).toContainEqual({
            source: "healthBar",
            label: "Health bar 2 front",
            detail: "healthBar=2; width=30",
        });
        expect(getSpriteReferences(index, 303, 0)).toContainEqual({
            source: "hitSplat",
            label: "Hitsplat 4 icon",
            detail: "hitSplat=4",
        });
    });

    test("sorts manifest entries by archive and frame id", () => {
        const manifest = buildSpriteExportManifest(
            CACHE_INFO,
            "dat2",
            [
                {
                    path: "3/1.png",
                    archiveId: 3,
                    frameIndex: 1,
                    frameCount: 2,
                    primaryLabel: "b",
                    labels: ["b"],
                    references: [],
                    image: {
                        exportedWidth: 1,
                        exportedHeight: 1,
                        sourceSubWidth: 1,
                        sourceSubHeight: 1,
                        xOffset: 0,
                        yOffset: 0,
                    },
                },
                {
                    path: "2.png",
                    archiveId: 2,
                    frameIndex: 0,
                    frameCount: 1,
                    primaryLabel: "a",
                    labels: ["a"],
                    references: [],
                    image: {
                        exportedWidth: 1,
                        exportedHeight: 1,
                        sourceSubWidth: 1,
                        sourceSubHeight: 1,
                        xOffset: 0,
                        yOffset: 0,
                    },
                },
            ],
            "2026-04-12T00:00:00.000Z",
        );

        expect(manifest.format).toBe("scape.sprite-export.v1");
        expect(manifest.spriteCount).toBe(2);
        expect(manifest.sprites.map((entry) => entry.path)).toEqual(["2.png", "3/1.png"]);
    });
});
