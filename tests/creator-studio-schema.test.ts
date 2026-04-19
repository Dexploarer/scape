import { describe, expect, test } from "bun:test";

import {
    buildTemplateChunkGrid,
    createEmptyCreatorStudioProject,
    normalizeCreatorStudioProject,
    serializeCreatorStudioProject,
    summarizeWorldProject,
    templateChunkPlacementFromTile,
    upsertTemplateChunkPlacement,
} from "../src/editor/projectSchema";
import { unpackTemplateChunk } from "../src/shared/instance/InstanceTypes";

describe("creator studio schema", () => {
    test("converts a tile click into a template chunk placement and compiles it into the instance grid", () => {
        const project = createEmptyCreatorStudioProject();
        const placement = templateChunkPlacementFromTile(
            {
                destPlane: 0,
                destChunkX: 6,
                destChunkY: 6,
                rotation: 1,
            },
            { x: 3205, y: 3217, level: 2 },
        );

        const world = upsertTemplateChunkPlacement(project.world, placement);
        const grid = buildTemplateChunkGrid(world);
        const unpacked = unpackTemplateChunk(grid[0][6][6]);

        expect(unpacked).toEqual({
            plane: 2,
            chunkX: Math.floor(3205 / 8),
            chunkY: Math.floor(3217 / 8),
            rotation: 1,
        });
    });

    test("summarizes referenced regions from compiled template chunks", () => {
        const project = createEmptyCreatorStudioProject();
        const world = upsertTemplateChunkPlacement(
            upsertTemplateChunkPlacement(
                project.world,
                templateChunkPlacementFromTile(
                    { destPlane: 0, destChunkX: 0, destChunkY: 0, rotation: 0 },
                    { x: 3200, y: 3200, level: 0 },
                ),
            ),
            templateChunkPlacementFromTile(
                { destPlane: 1, destChunkX: 1, destChunkY: 1, rotation: 2 },
                { x: 3328, y: 3200, level: 1 },
            ),
        );

        const summary = summarizeWorldProject(world);

        expect(summary.templateChunkCount).toBe(2);
        expect(summary.occupiedChunkCount).toBe(2);
        expect(summary.regionIds).toEqual([12850, 13362]);
    });

    test("normalizes imported project data and preserves quest/world entries", () => {
        const normalized = normalizeCreatorStudioProject({
            world: {
                id: "toon_world",
                name: "Toon World",
                templateChunks: [
                    {
                        destPlane: 0,
                        destChunkX: 4,
                        destChunkY: 5,
                        sourcePlane: 0,
                        sourceChunkX: 400,
                        sourceChunkY: 401,
                        rotation: 3,
                    },
                ],
                locPlacements: [{ locId: 100, x: 3200, y: 3201, level: 0, type: 10, rotation: 1 }],
                npcSpawns: [{ npcId: 200, x: 3202, y: 3203, level: 0, wanderRadius: 4 }],
            },
            quests: [
                {
                    id: "sheep_trouble",
                    name: "Sheep Trouble",
                    startStageId: "stage_a",
                    stages: [
                        {
                            id: "stage_a",
                            title: "Talk to Fred",
                            objectives: ["Talk to Fred the Farmer"],
                            triggers: [
                                { kind: "npc_interaction", target: "758", value: "Talk-to" },
                            ],
                        },
                    ],
                },
            ],
        });

        expect(normalized.world.id).toBe("toon_world");
        expect(normalized.world.templateChunks).toHaveLength(1);
        expect(normalized.world.locPlacements[0]?.locId).toBe(100);
        expect(normalized.world.npcSpawns[0]?.npcId).toBe(200);
        expect(normalized.quests[0]?.id).toBe("sheep_trouble");
        expect(normalized.quests[0]?.stages[0]?.triggers[0]?.kind).toBe("npc_interaction");
    });

    test("serializes projects with the current creator studio version", () => {
        const project = createEmptyCreatorStudioProject();
        const serialized = serializeCreatorStudioProject(project);
        const parsed = JSON.parse(serialized);

        expect(parsed.version).toBe(1);
        expect(typeof parsed.updatedAt).toBe("string");
        expect(parsed.world.id).toBe(project.world.id);
    });
});
