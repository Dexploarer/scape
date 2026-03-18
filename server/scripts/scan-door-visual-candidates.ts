import path from "path";

import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { ModelData } from "../../src/rs/model/ModelData";
import { initCacheEnv } from "../src/world/CacheEnv";

type CliOptions = {
    cacheName?: string;
    closedIds: number[];
    top: number;
    minScore: number;
    closeOnly: boolean;
    gateOnly: boolean;
    compact: boolean;
};

type ModelSignature = {
    id: number;
    vertices: number;
    faces: number;
    texturedFaces: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    colorSum: number;
    colorXor: number;
    colorMin: number;
    colorMax: number;
    colorUnique: number;
};

type LocSignature = {
    id: number;
    name: string;
    hasOpen: boolean;
    hasClose: boolean;
    isInteractive: number;
    clipType: number;
    blocksProjectile: boolean;
    types: number[];
    modelIds: number[];
    modelsResolved: number;
    vertices: number;
    faces: number;
    texturedFaces: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    colorSum: number;
    colorXor: number;
    colorMin: number;
    colorMax: number;
    colorUnique: number;
    modelSizeX: number;
    modelSizeY: number;
    modelSizeHeight: number;
    offsetX: number;
    offsetY: number;
    offsetHeight: number;
    actions: (string | null)[];
};

type Candidate = {
    id: number;
    score: number;
    modelSimilarityPct: number;
    name: string;
    hasOpen: boolean;
    hasClose: boolean;
    isInteractive: number;
    modelIds: number[];
    types: number[];
    clipType: number;
    blocksProjectile: boolean;
    actions: (string | null)[];
};

const DEFAULT_TOP = 40;
const DEFAULT_MIN_SCORE = 30;

function parseIdList(raw: string): number[] {
    return raw
        .split(",")
        .map((entry) => parseInt(entry.trim(), 10))
        .filter((value) => Number.isFinite(value));
}

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = {
        closedIds: [],
        top: DEFAULT_TOP,
        minScore: DEFAULT_MIN_SCORE,
        closeOnly: false,
        gateOnly: false,
        compact: false,
    };

    for (const arg of argv) {
        if (arg.startsWith("--cache=")) {
            opts.cacheName = arg.slice("--cache=".length);
            continue;
        }
        if (arg.startsWith("--closed=")) {
            const ids = parseIdList(arg.slice("--closed=".length));
            opts.closedIds = [...new Set(ids)];
            continue;
        }
        if (arg.startsWith("--top=")) {
            const value = parseInt(arg.slice("--top=".length), 10);
            if (Number.isFinite(value) && value > 0) {
                opts.top = value;
            }
            continue;
        }
        if (arg.startsWith("--min-score=")) {
            const value = parseFloat(arg.slice("--min-score=".length));
            if (Number.isFinite(value) && value >= 0) {
                opts.minScore = value;
            }
            continue;
        }
        if (arg === "--close-only") {
            opts.closeOnly = true;
            continue;
        }
        if (arg === "--gate-only") {
            opts.gateOnly = true;
            continue;
        }
        if (arg === "--compact") {
            opts.compact = true;
            continue;
        }
        if (!arg.startsWith("-") && opts.closedIds.length === 0) {
            const ids = parseIdList(arg);
            opts.closedIds = [...new Set(ids)];
        }
    }

    return opts;
}

function normalizeActions(actions: unknown): (string | null)[] {
    if (!Array.isArray(actions)) {
        return [null, null, null, null, null];
    }
    const out: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
        const value = actions[i] as string | null | undefined;
        out.push(value?.constructor === String ? value : null);
    }
    return out;
}

function hasAction(actions: (string | null)[], action: string): boolean {
    const wanted = action.toLowerCase();
    return actions.some((entry) => entry !== null && entry.toLowerCase() === wanted);
}

function sortedUnique(values: number[]): number[] {
    return [...new Set(values.map((value) => value))].sort((a, b) => a - b);
}

function makeModelSignature(modelId: number, model: ModelData): ModelSignature {
    const verticesX = model.verticesX;
    const verticesY = model.verticesY;
    const verticesZ = model.verticesZ;

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < model.verticesCount; i++) {
        const x = verticesX[i];
        const y = verticesY[i];
        const z = verticesZ[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }

    const faceColors = model.faceColors;
    let colorSum = 0;
    let colorXor = 0;
    let colorMin = Number.POSITIVE_INFINITY;
    let colorMax = Number.NEGATIVE_INFINITY;
    const uniqueColors = new Set<number>();

    for (let i = 0; i < model.faceCount; i++) {
        const color = faceColors[i];
        colorSum = (colorSum + color) >>> 0;
        colorXor = (colorXor ^ color) >>> 0;
        if (color < colorMin) colorMin = color;
        if (color > colorMax) colorMax = color;
        uniqueColors.add(color);
    }

    return {
        id: modelId,
        vertices: model.verticesCount,
        faces: model.faceCount,
        texturedFaces: model.textureFaceCount,
        minX: Number.isFinite(minX) ? minX : 0,
        maxX: Number.isFinite(maxX) ? maxX : 0,
        minY: Number.isFinite(minY) ? minY : 0,
        maxY: Number.isFinite(maxY) ? maxY : 0,
        minZ: Number.isFinite(minZ) ? minZ : 0,
        maxZ: Number.isFinite(maxZ) ? maxZ : 0,
        colorSum: colorSum >>> 0,
        colorXor: colorXor >>> 0,
        colorMin: Number.isFinite(colorMin) ? colorMin : 0,
        colorMax: Number.isFinite(colorMax) ? colorMax : 0,
        colorUnique: uniqueColors.size,
    };
}

function buildLocSignature(
    id: number,
    loc: any,
    modelLoader: any,
    modelSigCache: Map<number, ModelSignature | null>,
): LocSignature | undefined {
    const modelsRaw = Array.isArray(loc.models)
        ? loc.models
              .flat()
              .map((value) => value as number)
              .filter((value) => Number.isFinite(value))
        : [];
    const modelIds = sortedUnique(modelsRaw);
    if (modelIds.length === 0) {
        return undefined;
    }

    let vertices = 0;
    let faces = 0;
    let texturedFaces = 0;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let colorSum = 0;
    let colorXor = 0;
    let colorMin = Number.POSITIVE_INFINITY;
    let colorMax = Number.NEGATIVE_INFINITY;
    let colorUnique = 0;
    let modelsResolved = 0;

    for (const modelId of modelIds) {
        let modelSig = modelSigCache.get(modelId);
        if (modelSig === undefined) {
            const model = modelLoader.getModel(modelId);
            modelSig = model ? makeModelSignature(modelId, model) : null;
            modelSigCache.set(modelId, modelSig);
        }
        if (!modelSig) {
            continue;
        }

        modelsResolved++;
        vertices += modelSig.vertices;
        faces += modelSig.faces;
        texturedFaces += modelSig.texturedFaces;
        if (modelSig.minX < minX) minX = modelSig.minX;
        if (modelSig.maxX > maxX) maxX = modelSig.maxX;
        if (modelSig.minY < minY) minY = modelSig.minY;
        if (modelSig.maxY > maxY) maxY = modelSig.maxY;
        if (modelSig.minZ < minZ) minZ = modelSig.minZ;
        if (modelSig.maxZ > maxZ) maxZ = modelSig.maxZ;
        colorSum = (colorSum + modelSig.colorSum) >>> 0;
        colorXor = (colorXor ^ modelSig.colorXor) >>> 0;
        if (modelSig.colorMin < colorMin) colorMin = modelSig.colorMin;
        if (modelSig.colorMax > colorMax) colorMax = modelSig.colorMax;
        colorUnique += modelSig.colorUnique;
    }

    if (modelsResolved <= 0) {
        return undefined;
    }

    const actions = normalizeActions(loc.actions);
    const types = sortedUnique(
        Array.isArray(loc.types)
            ? loc.types.map((value) => value as number).filter((value) => Number.isFinite(value))
            : [],
    );
    const isInteractiveValue = loc.isInteractive as number | undefined;
    const clipTypeValue = loc.clipType as number | undefined;
    const modelSizeXValue = loc.modelSizeX as number | undefined;
    const modelSizeYValue = loc.modelSizeY as number | undefined;
    const modelSizeHeightValue = loc.modelSizeHeight as number | undefined;
    const offsetXValue = loc.offsetX as number | undefined;
    const offsetYValue = loc.offsetY as number | undefined;
    const offsetHeightValue = loc.offsetHeight as number | undefined;
    const nameValue = loc.name as string | undefined;
    const isInteractive = Number.isFinite(isInteractiveValue) ? isInteractiveValue : 0;
    const clipType = Number.isFinite(clipTypeValue) ? clipTypeValue : 0;
    const modelSizeX = Number.isFinite(modelSizeXValue) ? modelSizeXValue : 128;
    const modelSizeY = Number.isFinite(modelSizeYValue) ? modelSizeYValue : 128;
    const modelSizeHeight = Number.isFinite(modelSizeHeightValue) ? modelSizeHeightValue : 128;
    const offsetX = Number.isFinite(offsetXValue) ? offsetXValue : 0;
    const offsetY = Number.isFinite(offsetYValue) ? offsetYValue : 0;
    const offsetHeight = Number.isFinite(offsetHeightValue) ? offsetHeightValue : 0;

    return {
        id: id,
        name: nameValue?.constructor === String ? nameValue.toLowerCase() : "",
        hasOpen: hasAction(actions, "open"),
        hasClose: hasAction(actions, "close"),
        isInteractive,
        clipType,
        blocksProjectile: loc.blocksProjectile !== false,
        types,
        modelIds,
        modelsResolved,
        vertices: vertices,
        faces: faces,
        texturedFaces: texturedFaces,
        minX: Number.isFinite(minX) ? minX : 0,
        maxX: Number.isFinite(maxX) ? maxX : 0,
        minY: Number.isFinite(minY) ? minY : 0,
        maxY: Number.isFinite(maxY) ? maxY : 0,
        minZ: Number.isFinite(minZ) ? minZ : 0,
        maxZ: Number.isFinite(maxZ) ? maxZ : 0,
        colorSum: colorSum >>> 0,
        colorXor: colorXor >>> 0,
        colorMin: Number.isFinite(colorMin) ? colorMin : 0,
        colorMax: Number.isFinite(colorMax) ? colorMax : 0,
        colorUnique: colorUnique,
        modelSizeX,
        modelSizeY,
        modelSizeHeight,
        offsetX,
        offsetY,
        offsetHeight,
        actions,
    };
}

function scoreModelOverlap(ref: LocSignature, cand: LocSignature): number {
    const refSet = new Set(ref.modelIds);
    const candSet = new Set(cand.modelIds);
    let intersection = 0;
    for (const id of refSet) {
        if (candSet.has(id)) {
            intersection++;
        }
    }
    const union = refSet.size + candSet.size - intersection;
    if (union <= 0) {
        return 0;
    }
    return Math.round((intersection / union) * 100);
}

function scoreCandidate(ref: LocSignature, cand: LocSignature): number {
    let score = 0;

    const modelSimilarityPct = scoreModelOverlap(ref, cand);
    score += Math.round((modelSimilarityPct / 100) * 60);

    if (ref.vertices === cand.vertices) score += 8;
    if (ref.faces === cand.faces) score += 8;
    if (ref.texturedFaces === cand.texturedFaces) score += 4;

    const sameBounds =
        ref.minX === cand.minX &&
        ref.maxX === cand.maxX &&
        ref.minY === cand.minY &&
        ref.maxY === cand.maxY &&
        ref.minZ === cand.minZ &&
        ref.maxZ === cand.maxZ;
    if (sameBounds) score += 10;

    if (ref.colorSum === cand.colorSum) score += 5;
    if (ref.colorXor === cand.colorXor) score += 5;
    if (ref.colorMin === cand.colorMin && ref.colorMax === cand.colorMax) score += 4;

    const sameScale =
        ref.modelSizeX === cand.modelSizeX &&
        ref.modelSizeY === cand.modelSizeY &&
        ref.modelSizeHeight === cand.modelSizeHeight;
    if (sameScale) score += 4;

    const sameOffset =
        ref.offsetX === cand.offsetX &&
        ref.offsetY === cand.offsetY &&
        ref.offsetHeight === cand.offsetHeight;
    if (sameOffset) score += 3;

    if (ref.clipType === cand.clipType) score += 3;
    if (ref.blocksProjectile === cand.blocksProjectile) score += 2;
    if (JSON.stringify(ref.types) === JSON.stringify(cand.types)) score += 4;

    if (cand.name.includes("gate")) score += 2;

    return score;
}

function main(): void {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.closedIds.length === 0) {
        console.log(
            [
                "Usage:",
                "  npx tsx server/scripts/scan-door-visual-candidates.ts --closed=52,53",
                "Options:",
                "  --cache=<name>       Cache folder name under ./caches",
                `  --top=<n>            Max candidates to print (default ${DEFAULT_TOP})`,
                `  --min-score=<n>      Minimum similarity score (default ${DEFAULT_MIN_SCORE})`,
                "  --close-only         Keep only candidates with a Close action",
                "  --gate-only          Keep only candidates whose name contains 'gate'",
                "  --compact            Print compact JSON",
            ].join("\n"),
        );
        process.exit(1);
    }

    const repoRoot = path.resolve(__dirname, "../..");
    const env = initCacheEnv(path.join(repoRoot, "caches"), opts.cacheName);
    const factory = getCacheLoaderFactory(env.info, env.cacheSystem as any) as any;
    const locTypeLoader = factory.getLocTypeLoader();
    const modelLoader = factory.getModelLoader();

    const modelSigCache = new Map<number, ModelSignature | null>();
    const refs: LocSignature[] = [];
    for (const closedId of opts.closedIds) {
        const loc = locTypeLoader.load(closedId);
        if (!loc) continue;
        const sig = buildLocSignature(closedId, loc, modelLoader, modelSigCache);
        if (sig) refs.push(sig);
    }

    if (refs.length === 0) {
        console.log(
            JSON.stringify({ error: "No valid closed IDs found", closedIds: opts.closedIds }),
        );
        process.exit(2);
    }

    const ref = refs[0];
    const locCount = locTypeLoader.getCount();
    const candidates: Candidate[] = [];

    for (let id = 0; id < locCount; id++) {
        const locId = id;
        if (opts.closedIds.includes(locId)) {
            continue;
        }

        const loc = locTypeLoader.load(locId);
        if (!loc) continue;

        const sig = buildLocSignature(locId, loc, modelLoader, modelSigCache);
        if (!sig) continue;

        if (opts.closeOnly && !sig.hasClose) {
            continue;
        }
        if (opts.gateOnly && !sig.name.includes("gate")) {
            continue;
        }

        const score = scoreCandidate(ref, sig);
        if (score < opts.minScore) {
            continue;
        }

        candidates.push({
            id: sig.id,
            score,
            modelSimilarityPct: scoreModelOverlap(ref, sig),
            name: sig.name,
            hasOpen: sig.hasOpen,
            hasClose: sig.hasClose,
            isInteractive: sig.isInteractive,
            modelIds: sig.modelIds,
            types: sig.types,
            clipType: sig.clipType,
            blocksProjectile: sig.blocksProjectile,
            actions: sig.actions,
        });
    }

    candidates.sort((a, b) => b.score - a.score || a.id - b.id);

    const summary = {
        cache: env.info,
        query: {
            closedIds: opts.closedIds,
            top: opts.top,
            minScore: opts.minScore,
            closeOnly: opts.closeOnly,
            gateOnly: opts.gateOnly,
        },
        reference: refs.map((entry) => ({
            id: entry.id,
            name: entry.name,
            hasOpen: entry.hasOpen,
            hasClose: entry.hasClose,
            isInteractive: entry.isInteractive,
            modelIds: entry.modelIds,
            types: entry.types,
            clipType: entry.clipType,
            blocksProjectile: entry.blocksProjectile,
            actions: entry.actions,
        })),
        candidates: candidates.slice(0, Math.max(1, opts.top)),
    };

    if (opts.compact) {
        console.log(JSON.stringify(summary));
    } else {
        console.log(JSON.stringify(summary, null, 2));
    }
}

main();
