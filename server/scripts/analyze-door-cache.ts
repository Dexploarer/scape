import fs from "fs";
import path from "path";

import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { initCacheEnv } from "../src/world/CacheEnv";
import { readSingleDoorDefsFromFile } from "../src/world/DoorCatalogFile";

type CliOptions = {
    cacheName?: string;
    compact: boolean;
    limit: number;
};

type DoorCandidate = {
    id: number;
    name: string;
    hasOpen: boolean;
    hasClose: boolean;
    sizeX: number;
    sizeY: number;
    clipType: number;
    blocksProjectile: boolean;
    types: number[];
    models: number[];
};

type DoorGroup = {
    fingerprint: string;
    openOnly: DoorCandidate[];
    closeOnly: DoorCandidate[];
    both: DoorCandidate[];
};

type ExistingSingleDoor = { closed: number; opened: number };

const WALL_MODEL_TYPES = new Set([0, 1, 2, 3, 9]);
const DOOR_NAME_HINTS = ["door", "gate", "grill", "portcullis", "trapdoor"];
const HIGH_CONFIDENCE_MAX_DISTANCE = 3;

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = {
        compact: false,
        limit: 25,
    };

    for (const arg of argv) {
        if (arg.startsWith("--cache=")) {
            opts.cacheName = arg.slice("--cache=".length);
            continue;
        }
        if (arg.startsWith("--limit=")) {
            const raw = parseInt(arg.slice("--limit=".length), 10);
            if (Number.isFinite(raw) && raw > 0) {
                opts.limit = raw;
            }
            continue;
        }
        if (arg === "--compact") {
            opts.compact = true;
            continue;
        }
        // positional cache name
        if (!arg.startsWith("-") && !opts.cacheName) {
            opts.cacheName = arg;
        }
    }

    return opts;
}

function normalizeAction(action: unknown): string | undefined {
    const text = action as string | undefined;
    if (text?.constructor !== String) return undefined;
    const normalized = text.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

function uniqueSorted(values: number[]): number[] {
    return [...new Set(values.map((v) => v))].sort((a, b) => a - b);
}

function hasDoorNameHint(name: string): boolean {
    return DOOR_NAME_HINTS.some((hint) => name.includes(hint));
}

function buildFingerprint(candidate: DoorCandidate): string {
    return JSON.stringify({
        n: candidate.name,
        sx: candidate.sizeX,
        sy: candidate.sizeY,
        clip: candidate.clipType,
        proj: candidate.blocksProjectile,
        t: candidate.types,
        m: candidate.models,
    });
}

function loadExistingSingleDoors(repoRoot: string): ExistingSingleDoor[] {
    const file = path.join(repoRoot, "server/data/doors.json");
    if (!fs.existsSync(file)) return [];
    try {
        return readSingleDoorDefsFromFile(file).map((entry) => ({
            closed: entry.closed,
            opened: entry.opened,
        }));
    } catch {
        return [];
    }
}

function greedyPairByNearest(
    closedIds: number[],
    openedIds: number[],
): Array<{ closed: number; opened: number; distance: number }> {
    const sortedClosed = [...closedIds].sort((a, b) => a - b);
    const sortedOpened = [...openedIds].sort((a, b) => a - b);
    const usedOpened = new Set<number>();
    const pairs: Array<{ closed: number; opened: number; distance: number }> = [];

    for (const closed of sortedClosed) {
        let bestIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < sortedOpened.length; i++) {
            if (usedOpened.has(i)) continue;
            const distance = Math.abs(sortedOpened[i] - closed);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }
        if (bestIndex === -1) continue;
        usedOpened.add(bestIndex);
        pairs.push({
            closed: closed,
            opened: sortedOpened[bestIndex],
            distance: bestDistance,
        });
    }

    return pairs;
}

function main(): void {
    const opts = parseArgs(process.argv.slice(2));
    const repoRoot = path.resolve(__dirname, "../..");

    const env = initCacheEnv(path.join(repoRoot, "caches"), opts.cacheName);
    const factory = getCacheLoaderFactory(env.info, env.cacheSystem as any);
    const locTypeLoader: any = factory.getLocTypeLoader();
    const locCount = locTypeLoader.getCount();

    const groupsByFingerprint = new Map<string, DoorGroup>();
    let totalOpenOrCloseCandidates = 0;
    let totalWallDoorCandidates = 0;
    let ignoredNonWall = 0;
    let ignoredNonDoorName = 0;

    for (let id = 0; id < locCount; id++) {
        const loc = locTypeLoader.load(id);
        if (!loc) continue;

        const actions = (Array.isArray(loc.actions) ? loc.actions : [])
            .map(normalizeAction)
            .filter((action: string | undefined): action is string => !!action);
        const hasOpen = actions.includes("open");
        const hasClose = actions.includes("close");
        if (!hasOpen && !hasClose) continue;
        totalOpenOrCloseCandidates++;

        const types = uniqueSorted(
            (Array.isArray(loc.types) ? loc.types : [])
                .map((value) => value as number)
                .filter((value) => Number.isFinite(value)),
        );
        if (!types.some((type) => WALL_MODEL_TYPES.has(type))) {
            ignoredNonWall++;
            continue;
        }

        const rawName = loc.name as string | undefined;
        const name = rawName?.constructor === String ? rawName.trim().toLowerCase() : "";
        if (!hasDoorNameHint(name)) {
            ignoredNonDoorName++;
            continue;
        }

        totalWallDoorCandidates++;
        const sizeXValue = loc.sizeX as number | undefined;
        const sizeYValue = loc.sizeY as number | undefined;
        const clipTypeValue = loc.clipType as number | undefined;
        const sizeX = Number.isFinite(sizeXValue) ? Math.max(1, sizeXValue) : 1;
        const sizeY = Number.isFinite(sizeYValue) ? Math.max(1, sizeYValue) : 1;
        const clipType = Number.isFinite(clipTypeValue) ? clipTypeValue : 0;

        const candidate: DoorCandidate = {
            id: id,
            name,
            hasOpen,
            hasClose,
            sizeX,
            sizeY,
            clipType,
            blocksProjectile: loc.blocksProjectile !== false,
            types,
            models: uniqueSorted(
                (Array.isArray(loc.models) ? loc.models.flat() : [])
                    .map((value) => value as number)
                    .filter((value) => Number.isFinite(value)),
            ),
        };

        const fingerprint = buildFingerprint(candidate);
        const group =
            groupsByFingerprint.get(fingerprint) ??
            ({
                fingerprint,
                openOnly: [],
                closeOnly: [],
                both: [],
            } as DoorGroup);

        if (candidate.hasOpen && candidate.hasClose) {
            group.both.push(candidate);
        } else if (candidate.hasOpen) {
            // In cache semantics this is typically the closed state (action = Open).
            group.openOnly.push(candidate);
        } else if (candidate.hasClose) {
            // In cache semantics this is typically the opened state (action = Close).
            group.closeOnly.push(candidate);
        }

        groupsByFingerprint.set(fingerprint, group);
    }

    let exactOneToOneGroups = 0;
    let ambiguousGroups = 0;
    let unmatchedClosedIds = 0;
    let unmatchedOpenedIds = 0;

    const highConfidencePairs: Array<{ closed: number; opened: number; distance: number }> = [];
    const highConfidenceGroupFingerprints: string[] = [];
    const ambiguousPreview: Array<{
        closedIds: number[];
        openedIds: number[];
        bothIds: number[];
        fingerprint: string;
    }> = [];

    for (const group of groupsByFingerprint.values()) {
        const closedIds = group.openOnly.map((entry) => entry.id);
        const openedIds = group.closeOnly.map((entry) => entry.id);

        if (closedIds.length === 1 && openedIds.length === 1) {
            exactOneToOneGroups++;
            const distance = Math.abs(closedIds[0] - openedIds[0]);
            if (distance <= HIGH_CONFIDENCE_MAX_DISTANCE) {
                highConfidencePairs.push({
                    closed: closedIds[0],
                    opened: openedIds[0],
                    distance,
                });
                highConfidenceGroupFingerprints.push(group.fingerprint);
            } else {
                ambiguousGroups++;
                if (ambiguousPreview.length < opts.limit) {
                    ambiguousPreview.push({
                        closedIds: closedIds.slice(0, 16),
                        openedIds: openedIds.slice(0, 16),
                        bothIds: group.both.slice(0, 16).map((entry) => entry.id),
                        fingerprint: group.fingerprint,
                    });
                }
            }
            continue;
        }

        if (closedIds.length === 0 && openedIds.length === 0) {
            continue;
        }

        if (closedIds.length === 0) {
            unmatchedOpenedIds += openedIds.length;
            ambiguousGroups++;
        } else if (openedIds.length === 0) {
            unmatchedClosedIds += closedIds.length;
            ambiguousGroups++;
        } else {
            ambiguousGroups++;
            const tentativePairs = greedyPairByNearest(closedIds, openedIds);
            const canAutoPair =
                tentativePairs.length === closedIds.length &&
                tentativePairs.length === openedIds.length &&
                tentativePairs.every((pair) => pair.distance <= HIGH_CONFIDENCE_MAX_DISTANCE);
            if (canAutoPair) {
                highConfidencePairs.push(...tentativePairs);
                highConfidenceGroupFingerprints.push(group.fingerprint);
            } else if (ambiguousPreview.length < opts.limit) {
                ambiguousPreview.push({
                    closedIds: closedIds.slice(0, 16),
                    openedIds: openedIds.slice(0, 16),
                    bothIds: group.both.slice(0, 16).map((entry) => entry.id),
                    fingerprint: group.fingerprint,
                });
            }
        }
    }

    highConfidencePairs.sort((a, b) => a.closed - b.closed || a.opened - b.opened);

    const existing = loadExistingSingleDoors(repoRoot);
    const existingKeySet = new Set(existing.map((pair) => `${pair.closed}:${pair.opened}`));
    const missingFromCurrent = highConfidencePairs.filter(
        (pair) => !existingKeySet.has(`${pair.closed}:${pair.opened}`),
    );

    const summary = {
        cache: env.info,
        locCount,
        totals: {
            openOrCloseCandidates: totalOpenOrCloseCandidates,
            wallDoorCandidates: totalWallDoorCandidates,
            ignoredNonWall,
            ignoredNonDoorName,
        },
        grouping: {
            fingerprintGroups: groupsByFingerprint.size,
            exactOneToOneGroups,
            ambiguousGroups,
            unmatchedClosedIds,
            unmatchedOpenedIds,
        },
        pairing: {
            highConfidencePairCount: highConfidencePairs.length,
            highConfidenceMaxDistance: HIGH_CONFIDENCE_MAX_DISTANCE,
            missingFromCurrentSingleDoors: missingFromCurrent.length,
            currentSingleDoorsCount: existing.length,
        },
        missingFromCurrentSingleDoorsPreview: missingFromCurrent.slice(0, opts.limit),
        ambiguousGroupPreview: ambiguousPreview,
    };

    if (opts.compact) {
        // Compact mode keeps output machine-friendly.
        console.log(JSON.stringify(summary));
    } else {
        console.log(JSON.stringify(summary, null, 2));
    }
}

main();
