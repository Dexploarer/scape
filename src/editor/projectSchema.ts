import {
    CHUNK_SIZE,
    INSTANCE_CHUNK_COUNT,
    createEmptyTemplateChunks,
    deriveRegionsFromTemplates,
    packTemplateChunk,
} from "../shared/instance/InstanceTypes";

export const CREATOR_STUDIO_PROJECT_VERSION = 1;

export type WorldEditTool = "template" | "loc" | "npc";

export interface TilePoint {
    x: number;
    y: number;
    level: number;
}

export interface TemplateChunkPlacement {
    id: string;
    destPlane: number;
    destChunkX: number;
    destChunkY: number;
    sourcePlane: number;
    sourceChunkX: number;
    sourceChunkY: number;
    rotation: number;
    label: string;
}

export interface WorldLocPlacement {
    id: string;
    locId: number;
    x: number;
    y: number;
    level: number;
    type: number;
    rotation: number;
    label: string;
}

export interface WorldNpcSpawn {
    id: string;
    npcId: number;
    x: number;
    y: number;
    level: number;
    wanderRadius: number;
    label: string;
}

export interface WorldProject {
    id: string;
    name: string;
    description: string;
    cacheName: string;
    origin: TilePoint;
    templateChunks: TemplateChunkPlacement[];
    locPlacements: WorldLocPlacement[];
    npcSpawns: WorldNpcSpawn[];
}

export type QuestTriggerKind =
    | "npc_interaction"
    | "loc_interaction"
    | "item_on_loc"
    | "widget_action"
    | "region_enter"
    | "varp_value"
    | "varbit_value";

export type QuestActionKind =
    | "dialogue"
    | "set_varp"
    | "set_varbit"
    | "spawn_loc"
    | "remove_loc"
    | "give_item"
    | "teleport";

export interface QuestTrigger {
    id: string;
    kind: QuestTriggerKind;
    target: string;
    value: string;
}

export interface QuestAction {
    id: string;
    kind: QuestActionKind;
    target: string;
    value: string;
}

export interface QuestDialogueLine {
    id: string;
    speaker: string;
    text: string;
}

export interface QuestStage {
    id: string;
    title: string;
    journalText: string;
    objectives: string[];
    triggers: QuestTrigger[];
    actions: QuestAction[];
    dialogue: QuestDialogueLine[];
}

export interface QuestProject {
    id: string;
    name: string;
    description: string;
    startStageId: string;
    prerequisites: string[];
    rewards: string[];
    stages: QuestStage[];
}

export interface CreatorStudioProject {
    version: number;
    updatedAt: string;
    world: WorldProject;
    quests: QuestProject[];
}

function createId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function slugifyProjectId(raw: string, fallback: string): string {
    const value = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return value || fallback;
}

export function createEmptyQuestStage(index: number = 1): QuestStage {
    return {
        id: `stage_${index}`,
        title: `Stage ${index}`,
        journalText: "",
        objectives: [""],
        triggers: [
            {
                id: createId("trigger"),
                kind: "npc_interaction",
                target: "",
                value: "Talk-to",
            },
        ],
        actions: [
            {
                id: createId("action"),
                kind: "dialogue",
                target: "",
                value: "",
            },
        ],
        dialogue: [
            {
                id: createId("dialogue"),
                speaker: "NPC",
                text: "",
            },
        ],
    };
}

export function createEmptyQuest(index: number = 1): QuestProject {
    const stage = createEmptyQuestStage(index);
    const id = `quest_${index}`;
    return {
        id,
        name: `Quest ${index}`,
        description: "",
        startStageId: stage.id,
        prerequisites: [],
        rewards: [],
        stages: [stage],
    };
}

export function createEmptyWorldProject(): WorldProject {
    return {
        id: "new_world",
        name: "New World",
        description: "",
        cacheName: "",
        origin: {
            x: 3200,
            y: 3200,
            level: 0,
        },
        templateChunks: [],
        locPlacements: [],
        npcSpawns: [],
    };
}

export function createEmptyCreatorStudioProject(): CreatorStudioProject {
    return {
        version: CREATOR_STUDIO_PROJECT_VERSION,
        updatedAt: new Date(0).toISOString(),
        world: createEmptyWorldProject(),
        quests: [createEmptyQuest(1)],
    };
}

export function templateChunkPlacementFromTile(
    placement: Pick<TemplateChunkPlacement, "destPlane" | "destChunkX" | "destChunkY" | "rotation">,
    tile: TilePoint,
): TemplateChunkPlacement {
    return {
        id: createId("chunk"),
        destPlane: clampPlane(placement.destPlane),
        destChunkX: clampChunkIndex(placement.destChunkX),
        destChunkY: clampChunkIndex(placement.destChunkY),
        sourcePlane: clampPlane(tile.level),
        sourceChunkX: Math.max(0, Math.floor(tile.x / CHUNK_SIZE)),
        sourceChunkY: Math.max(0, Math.floor(tile.y / CHUNK_SIZE)),
        rotation: clampRotation(placement.rotation),
        label: `Chunk ${Math.floor(tile.x / CHUNK_SIZE)},${Math.floor(tile.y / CHUNK_SIZE)}`,
    };
}

export function upsertTemplateChunkPlacement(
    world: WorldProject,
    nextPlacement: TemplateChunkPlacement,
): WorldProject {
    const templateChunks = world.templateChunks.filter(
        (entry) =>
            !(
                entry.destPlane === nextPlacement.destPlane &&
                entry.destChunkX === nextPlacement.destChunkX &&
                entry.destChunkY === nextPlacement.destChunkY
            ),
    );
    templateChunks.push({
        ...nextPlacement,
        id: nextPlacement.id || createId("chunk"),
    });
    return {
        ...world,
        templateChunks,
    };
}

export function buildTemplateChunkGrid(world: WorldProject): number[][][] {
    const grid = createEmptyTemplateChunks();
    for (const entry of world.templateChunks) {
        const plane = clampPlane(entry.destPlane);
        const chunkX = clampChunkIndex(entry.destChunkX);
        const chunkY = clampChunkIndex(entry.destChunkY);
        grid[plane][chunkX][chunkY] = packTemplateChunk(
            clampPlane(entry.sourcePlane),
            Math.max(0, entry.sourceChunkX | 0),
            Math.max(0, entry.sourceChunkY | 0),
            clampRotation(entry.rotation),
        );
    }
    return grid;
}

export interface WorldProjectSummary {
    templateChunkCount: number;
    occupiedChunkCount: number;
    locCount: number;
    npcCount: number;
    regionIds: number[];
}

export function summarizeWorldProject(world: WorldProject): WorldProjectSummary {
    const grid = buildTemplateChunkGrid(world);
    const occupiedChunkCount = world.templateChunks.reduce((count, entry) => {
        if (
            entry.destPlane >= 0 &&
            entry.destPlane < 4 &&
            entry.destChunkX >= 0 &&
            entry.destChunkX < INSTANCE_CHUNK_COUNT &&
            entry.destChunkY >= 0 &&
            entry.destChunkY < INSTANCE_CHUNK_COUNT
        ) {
            return count + 1;
        }
        return count;
    }, 0);
    return {
        templateChunkCount: world.templateChunks.length,
        occupiedChunkCount,
        locCount: world.locPlacements.length,
        npcCount: world.npcSpawns.length,
        regionIds: deriveRegionsFromTemplates(grid),
    };
}

function normalizeStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeTrigger(raw: unknown, index: number): QuestTrigger {
    const record = isRecord(raw) ? raw : {};
    return {
        id: typeof record.id === "string" ? record.id : `trigger_${index + 1}`,
        kind: isQuestTriggerKind(record.kind) ? record.kind : "npc_interaction",
        target: typeof record.target === "string" ? record.target : "",
        value: typeof record.value === "string" ? record.value : "",
    };
}

function normalizeAction(raw: unknown, index: number): QuestAction {
    const record = isRecord(raw) ? raw : {};
    return {
        id: typeof record.id === "string" ? record.id : `action_${index + 1}`,
        kind: isQuestActionKind(record.kind) ? record.kind : "dialogue",
        target: typeof record.target === "string" ? record.target : "",
        value: typeof record.value === "string" ? record.value : "",
    };
}

function normalizeDialogueLine(raw: unknown, index: number): QuestDialogueLine {
    const record = isRecord(raw) ? raw : {};
    return {
        id: typeof record.id === "string" ? record.id : `dialogue_${index + 1}`,
        speaker: typeof record.speaker === "string" ? record.speaker : "NPC",
        text: typeof record.text === "string" ? record.text : "",
    };
}

function normalizeStage(raw: unknown, index: number): QuestStage {
    const fallback = createEmptyQuestStage(index + 1);
    const record = isRecord(raw) ? raw : {};
    return {
        id: typeof record.id === "string" ? record.id : fallback.id,
        title: typeof record.title === "string" ? record.title : fallback.title,
        journalText:
            typeof record.journalText === "string" ? record.journalText : fallback.journalText,
        objectives:
            Array.isArray(record.objectives) && record.objectives.length > 0
                ? record.objectives.map((value) => (typeof value === "string" ? value : ""))
                : fallback.objectives,
        triggers: Array.isArray(record.triggers)
            ? record.triggers.map(normalizeTrigger)
            : fallback.triggers,
        actions: Array.isArray(record.actions)
            ? record.actions.map(normalizeAction)
            : fallback.actions,
        dialogue: Array.isArray(record.dialogue)
            ? record.dialogue.map(normalizeDialogueLine)
            : fallback.dialogue,
    };
}

function normalizeQuest(raw: unknown, index: number): QuestProject {
    const fallback = createEmptyQuest(index + 1);
    const record = isRecord(raw) ? raw : {};
    const stages =
        Array.isArray(record.stages) && record.stages.length > 0
            ? record.stages.map(normalizeStage)
            : fallback.stages;
    const startStageId =
        typeof record.startStageId === "string" && record.startStageId
            ? record.startStageId
            : stages[0]?.id ?? fallback.startStageId;
    return {
        id: typeof record.id === "string" ? record.id : fallback.id,
        name: typeof record.name === "string" ? record.name : fallback.name,
        description: typeof record.description === "string" ? record.description : "",
        startStageId,
        prerequisites: normalizeStringArray(record.prerequisites),
        rewards: normalizeStringArray(record.rewards),
        stages,
    };
}

function normalizeTemplateChunk(raw: unknown, index: number): TemplateChunkPlacement | null {
    const record = isRecord(raw) ? raw : {};
    if (
        typeof record.destChunkX !== "number" ||
        typeof record.destChunkY !== "number" ||
        typeof record.sourceChunkX !== "number" ||
        typeof record.sourceChunkY !== "number"
    ) {
        return null;
    }
    return {
        id: typeof record.id === "string" ? record.id : `chunk_${index + 1}`,
        destPlane: clampPlane(numberOrFallback(record.destPlane, 0)),
        destChunkX: clampChunkIndex(record.destChunkX),
        destChunkY: clampChunkIndex(record.destChunkY),
        sourcePlane: clampPlane(numberOrFallback(record.sourcePlane, 0)),
        sourceChunkX: Math.max(0, Math.floor(record.sourceChunkX)),
        sourceChunkY: Math.max(0, Math.floor(record.sourceChunkY)),
        rotation: clampRotation(numberOrFallback(record.rotation, 0)),
        label: typeof record.label === "string" ? record.label : "",
    };
}

function normalizeLocPlacement(raw: unknown, index: number): WorldLocPlacement | null {
    const record = isRecord(raw) ? raw : {};
    if (
        typeof record.locId !== "number" ||
        typeof record.x !== "number" ||
        typeof record.y !== "number"
    ) {
        return null;
    }
    return {
        id: typeof record.id === "string" ? record.id : `loc_${index + 1}`,
        locId: Math.max(0, Math.floor(record.locId)),
        x: Math.floor(record.x),
        y: Math.floor(record.y),
        level: clampPlane(numberOrFallback(record.level, 0)),
        type: Math.max(0, Math.floor(numberOrFallback(record.type, 10))),
        rotation: clampRotation(numberOrFallback(record.rotation, 0)),
        label: typeof record.label === "string" ? record.label : "",
    };
}

function normalizeNpcSpawn(raw: unknown, index: number): WorldNpcSpawn | null {
    const record = isRecord(raw) ? raw : {};
    if (
        typeof record.npcId !== "number" ||
        typeof record.x !== "number" ||
        typeof record.y !== "number"
    ) {
        return null;
    }
    return {
        id: typeof record.id === "string" ? record.id : `npc_${index + 1}`,
        npcId: Math.max(0, Math.floor(record.npcId)),
        x: Math.floor(record.x),
        y: Math.floor(record.y),
        level: clampPlane(numberOrFallback(record.level, 0)),
        wanderRadius: Math.max(0, Math.floor(numberOrFallback(record.wanderRadius, 0))),
        label: typeof record.label === "string" ? record.label : "",
    };
}

export function normalizeCreatorStudioProject(raw: unknown): CreatorStudioProject {
    const fallback = createEmptyCreatorStudioProject();
    const root = isRecord(raw) ? raw : {};
    const worldRecord = isRecord(root.world) ? root.world : {};
    const questsRaw = Array.isArray(root.quests) ? root.quests : fallback.quests;
    return {
        version: CREATOR_STUDIO_PROJECT_VERSION,
        updatedAt:
            typeof root.updatedAt === "string" && root.updatedAt
                ? root.updatedAt
                : fallback.updatedAt,
        world: {
            id: typeof worldRecord.id === "string" ? worldRecord.id : fallback.world.id,
            name: typeof worldRecord.name === "string" ? worldRecord.name : fallback.world.name,
            description: typeof worldRecord.description === "string" ? worldRecord.description : "",
            cacheName: typeof worldRecord.cacheName === "string" ? worldRecord.cacheName : "",
            origin: {
                x: Math.floor(
                    numberOrFallback(
                        worldRecord.origin && isRecord(worldRecord.origin)
                            ? worldRecord.origin.x
                            : undefined,
                        fallback.world.origin.x,
                    ),
                ),
                y: Math.floor(
                    numberOrFallback(
                        worldRecord.origin && isRecord(worldRecord.origin)
                            ? worldRecord.origin.y
                            : undefined,
                        fallback.world.origin.y,
                    ),
                ),
                level: clampPlane(
                    numberOrFallback(
                        worldRecord.origin && isRecord(worldRecord.origin)
                            ? worldRecord.origin.level
                            : undefined,
                        0,
                    ),
                ),
            },
            templateChunks: Array.isArray(worldRecord.templateChunks)
                ? worldRecord.templateChunks
                      .map(normalizeTemplateChunk)
                      .filter((entry): entry is TemplateChunkPlacement => entry !== null)
                : fallback.world.templateChunks,
            locPlacements: Array.isArray(worldRecord.locPlacements)
                ? worldRecord.locPlacements
                      .map(normalizeLocPlacement)
                      .filter((entry): entry is WorldLocPlacement => entry !== null)
                : fallback.world.locPlacements,
            npcSpawns: Array.isArray(worldRecord.npcSpawns)
                ? worldRecord.npcSpawns
                      .map(normalizeNpcSpawn)
                      .filter((entry): entry is WorldNpcSpawn => entry !== null)
                : fallback.world.npcSpawns,
        },
        quests: questsRaw.map(normalizeQuest),
    };
}

export function serializeCreatorStudioProject(project: CreatorStudioProject): string {
    return JSON.stringify(
        {
            ...project,
            version: CREATOR_STUDIO_PROJECT_VERSION,
            updatedAt: new Date().toISOString(),
        },
        null,
        2,
    );
}

function numberOrFallback(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampPlane(value: number): number {
    return Math.max(0, Math.min(3, Math.floor(value)));
}

function clampChunkIndex(value: number): number {
    return Math.max(0, Math.min(INSTANCE_CHUNK_COUNT - 1, Math.floor(value)));
}

function clampRotation(value: number): number {
    return Math.max(0, Math.min(3, Math.floor(value)));
}

function isQuestTriggerKind(value: unknown): value is QuestTriggerKind {
    return (
        value === "npc_interaction" ||
        value === "loc_interaction" ||
        value === "item_on_loc" ||
        value === "widget_action" ||
        value === "region_enter" ||
        value === "varp_value" ||
        value === "varbit_value"
    );
}

function isQuestActionKind(value: unknown): value is QuestActionKind {
    return (
        value === "dialogue" ||
        value === "set_varp" ||
        value === "set_varbit" ||
        value === "spawn_loc" ||
        value === "remove_loc" ||
        value === "give_item" ||
        value === "teleport"
    );
}
