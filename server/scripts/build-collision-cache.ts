// npx tsx server/scripts/build-collision-cache.ts --include-models
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { performance } from "perf_hooks";

import { CollisionMap } from "../../src/rs/scene/CollisionMap";
import { bitsetByteLength, bitsetSet } from "../src/utils/bitset";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

const MAX_MAP_X = 100; // Matches MapManager.MAX_MAP_X
const MAX_MAP_Y = 200; // Matches MapManager.MAX_MAP_Y
const LOG_INTERVAL_MS = 5_000;
const LOG_INTERVAL_STEPS = 25;

interface CliOptions {
    cacheName?: string;
    outDir?: string;
    includeModels: boolean;
    force: boolean;
}

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = {
        includeModels: false,
        force: false,
    };
    for (const arg of argv) {
        if (arg.startsWith("--cache=")) {
            opts.cacheName = arg.slice("--cache=".length);
        } else if (arg.startsWith("--out=")) {
            opts.outDir = arg.slice("--out=".length);
        } else if (arg === "--include-models") {
            opts.includeModels = true;
        } else if (arg === "--force") {
            opts.force = true;
        } else if (!opts.cacheName) {
            opts.cacheName = arg;
        } else if (!opts.outDir) {
            opts.outDir = arg;
        }
    }
    return opts;
}

function ensureBuffer(from: Int32Array): Buffer {
    return Buffer.from(from.buffer, from.byteOffset, from.byteLength);
}

function encodePlane(map: CollisionMap): Buffer {
    const header = Buffer.alloc(8);
    header.writeUInt16LE(map.sizeX, 0);
    header.writeUInt16LE(map.sizeY, 2);
    header.writeUInt32LE(map.flags.length, 4);
    const flags = ensureBuffer(map.flags);
    return Buffer.concat([header, flags]);
}

function encodeSquare(square: ReturnType<MapCollisionService["getMapSquare"]>): Buffer {
    if (!square) throw new Error("square is undefined");
    const version = 2;
    const planeCount = square.collisionMaps.length;
    const header = Buffer.alloc(24);
    header.writeUInt8(version, 0);
    header.writeUInt8(square.borderSize & 0xff, 1);
    header.writeUInt16LE(square.size & 0xffff, 2);
    header.writeUInt8(planeCount & 0xff, 4);
    header.writeUInt8(0, 5); // reserved
    header.writeUInt16LE(square.mapX & 0xffff, 6);
    header.writeUInt16LE(square.mapY & 0xffff, 8);
    header.writeInt32LE(square.baseX, 10);
    header.writeInt32LE(square.baseY, 14);
    header.writeUInt16LE(square.size & 0xffff, 18); // duplicate for compatibility
    header.writeUInt16LE(square.borderSize & 0xffff, 20);
    header.writeUInt16LE(0, 22); // reserved padding

    const planeBuffers = square.collisionMaps.map((cm) => encodePlane(cm));

    // Extra OSRS parity data: minimal bridge/min-plane flags needed to resolve collision plane without
    // rebuilding scenes on the server.
    //
    // Layout (v2, after plane buffers):
    // - uint32LE bitsetByteLen
    // - linkBelowBitset (tileRenderFlags[1] & 0x2)
    // - forceMin0Bitset[level=0..3] (tileRenderFlags[level] & 0x8)
    const tileCount = square.size * square.size;
    const bitsetLen = bitsetByteLength(tileCount);
    const metaHeader = Buffer.alloc(4);
    metaHeader.writeUInt32LE(bitsetLen >>> 0, 0);

    const linkBelow = new Uint8Array(bitsetLen);
    const forceMin0: Uint8Array[] = new Array(4);
    for (let l = 0; l < 4; l++) forceMin0[l] = new Uint8Array(bitsetLen);

    const flags = square.tileRenderFlags;
    if (flags) {
        for (let x = 0; x < square.size; x++) {
            for (let y = 0; y < square.size; y++) {
                const idx = x * square.size + y;
                const link = ((flags[1]?.[x]?.[y] ?? 0) & 0x2) !== 0;
                bitsetSet(linkBelow, idx, link);
                for (let l = 0; l < 4; l++) {
                    const fm0 = ((flags[l]?.[x]?.[y] ?? 0) & 0x8) !== 0;
                    bitsetSet(forceMin0[l], idx, fm0);
                }
            }
        }
    }

    const meta = Buffer.concat([
        metaHeader,
        Buffer.from(linkBelow.buffer, linkBelow.byteOffset, linkBelow.byteLength),
        Buffer.from(forceMin0[0].buffer, forceMin0[0].byteOffset, forceMin0[0].byteLength),
        Buffer.from(forceMin0[1].buffer, forceMin0[1].byteOffset, forceMin0[1].byteLength),
        Buffer.from(forceMin0[2].buffer, forceMin0[2].byteOffset, forceMin0[2].byteLength),
        Buffer.from(forceMin0[3].buffer, forceMin0[3].byteOffset, forceMin0[3].byteLength),
    ]);

    return Buffer.concat([header, ...planeBuffers, meta]);
}

async function ensureDir(dir: string): Promise<void> {
    await fsp.mkdir(dir, { recursive: true });
}

async function fileExists(file: string): Promise<boolean> {
    try {
        await fsp.access(file, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2));
    const { cacheName, includeModels, force } = opts;
    const env = initCacheEnv("caches", cacheName);
    const defaultOut = path.resolve("server/cache/collision");
    const outRoot = path.resolve(opts.outDir ?? defaultOut);
    await ensureDir(outRoot);

    const mapService = new MapCollisionService(env, includeModels, {
        usePrecomputed: false,
    });

    const start = performance.now();
    let lastLog = start;
    let built = 0;
    let skippedMissing = 0;
    let skippedExisting = 0;

    let totalCandidates = 0;
    for (let mapX = 0; mapX < MAX_MAP_X; mapX++) {
        for (let mapY = 0; mapY < MAX_MAP_Y; mapY++) {
            if (env.mapFileIndex.getTerrainArchiveId(mapX, mapY) !== -1) totalCandidates++;
        }
    }
    console.log(
        `collision cache build starting: totalCandidates=${totalCandidates}, output="${outRoot}",` +
            ` includeModels=${includeModels}`,
    );

    const progress = () => {
        const now = performance.now();
        const processed = built + skippedExisting + skippedMissing;
        if (processed === 0) return;
        if (
            processed % LOG_INTERVAL_STEPS !== 0 &&
            now - lastLog < LOG_INTERVAL_MS &&
            processed !== totalCandidates
        ) {
            return;
        }
        lastLog = now;
        const elapsedMs = now - start;
        const avgMs = elapsedMs / processed;
        const remaining = Math.max(0, totalCandidates - processed);
        const etaMs = avgMs * remaining;
        const pct = ((processed / Math.max(1, totalCandidates)) * 100).toFixed(1);
        const format = (ms: number) => {
            if (!Number.isFinite(ms)) return "--";
            if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
            if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
            return `${ms.toFixed(0)}ms`;
        };
        console.log(
            `progress ${processed}/${totalCandidates} (${pct}%) built=${built}` +
                ` skippedExisting=${skippedExisting} skippedMissing=${skippedMissing}` +
                ` elapsed=${format(elapsedMs)} eta=${format(etaMs)}`,
        );
    };

    for (let mapX = 0; mapX < MAX_MAP_X; mapX++) {
        for (let mapY = 0; mapY < MAX_MAP_Y; mapY++) {
            const terrainArchive = env.mapFileIndex.getTerrainArchiveId(mapX, mapY);
            if (terrainArchive === -1) {
                continue;
            }
            const outFile = path.join(outRoot, `${mapX}_${mapY}.bin`);
            if (!force && (await fileExists(outFile))) {
                skippedExisting++;
                progress();
                continue;
            }
            const square = mapService.getMapSquare(mapX, mapY);
            if (!square) {
                skippedMissing++;
                progress();
                continue;
            }
            const buffer = encodeSquare(square);
            await fsp.writeFile(outFile, buffer);
            built++;
            progress();
        }
    }

    const elapsed = performance.now() - start;
    console.log(
        `collision cache build complete: built=${built},` +
            ` skippedExisting=${skippedExisting}, skippedMissing=${skippedMissing},` +
            ` time=${elapsed.toFixed(0)}ms, output="${outRoot}"`,
    );
}

main().catch((err) => {
    console.error("build-collision-cache failed", err);
    process.exitCode = 1;
});
