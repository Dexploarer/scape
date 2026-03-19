/**
 * Generate dbtable and dbrow name mappings by hashing known names
 * and matching against cache reference table.
 */
import fs from "fs";
import path from "path";

import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { detectCacheType } from "../../src/rs/cache/CacheType";
import { ConfigType } from "../../src/rs/cache/ConfigType";
import { IndexType } from "../../src/rs/cache/IndexType";
import { StringUtil } from "../../src/rs/util/StringUtil";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

// Output directory for name files
const OUT_DIR = path.join(__dirname, "..", "..", "cs2-decompiler", "src", "data");

/**
 * Build a map from name hash -> archive ID using the reference table
 */
function buildHashToIdMap(
    cache: CacheSystem,
    indexId: number,
    configType: number,
): Map<number, number> {
    const hashToId = new Map<number, number>();
    const index = cache.getIndex(indexId);

    // For config types, the archive is the config type, files are individual configs
    const archive = index.getArchive(configType);
    if (!archive) {
        console.log(`No archive found for config type ${configType}`);
        return hashToId;
    }

    // Get file IDs from the archive
    const fileIds = archive.getFileIds();
    for (const fileId of fileIds) {
        // The file ID is the config ID
        hashToId.set(fileId, fileId);
    }

    return hashToId;
}

/**
 * Read case names from reference scripts
 */
function loadCaseNamesFromReferenceScripts(): string[] {
    const refScriptsDir = path.join(__dirname, "..", "..", "references", "cs2-scripts", "scripts");
    if (!fs.existsSync(refScriptsDir)) {
        console.log("Reference scripts directory not found");
        return [];
    }

    const names = new Set<string>();
    const files = fs.readdirSync(refScriptsDir).filter((f) => f.endsWith(".cs2"));

    for (const file of files) {
        const content = fs.readFileSync(path.join(refScriptsDir, file), "utf-8");
        // Extract case names: "case sailing_boat :" pattern
        const matches = content.matchAll(/case\s+([a-z_][a-z_0-9]*)\s*:/gi);
        for (const match of matches) {
            const name = match[1].toLowerCase();
            // Skip numeric-only names
            if (!/^\d+$/.test(name)) {
                names.add(name);
            }
        }
    }

    return Array.from(names).sort();
}

/**
 * Read db_getfield column references from reference scripts
 * Format: db_getfield($var, tablename:columnname, index)
 */
function loadDbColumnNamesFromReferenceScripts(): Map<string, string[]> {
    const refScriptsDir = path.join(__dirname, "..", "..", "references", "cs2-scripts", "scripts");
    if (!fs.existsSync(refScriptsDir)) {
        return new Map();
    }

    const tableColumns = new Map<string, Set<string>>();
    const files = fs.readdirSync(refScriptsDir).filter((f) => f.endsWith(".cs2"));

    for (const file of files) {
        const content = fs.readFileSync(path.join(refScriptsDir, file), "utf-8");
        // Extract db_getfield column references: "tablename:columnname"
        const matches = content.matchAll(
            /db_getfield\([^,]+,\s*([a-z_][a-z_0-9]*):([a-z_][a-z_0-9]*)/gi,
        );
        for (const match of matches) {
            const tableName = match[1].toLowerCase();
            const columnName = match[2].toLowerCase();
            if (!tableColumns.has(tableName)) {
                tableColumns.set(tableName, new Set());
            }
            tableColumns.get(tableName)!.add(columnName);
        }
    }

    const result = new Map<string, string[]>();
    for (const [table, cols] of tableColumns) {
        result.set(table, Array.from(cols).sort());
    }
    return result;
}

async function main() {
    // Load cache
    const cacheList = loadCacheList();
    const cacheInfos = loadCacheInfos(cacheList);
    const latestCache = cacheInfos[cacheInfos.length - 1];

    console.log(`Using cache: ${latestCache.name}`);

    const cache = loadCache(latestCache, cacheList);
    const cacheType = detectCacheType(cache);
    console.log(`Cache type: ${cacheType}`);

    // Get config index
    const configIndex = cache.getIndex(IndexType.CONFIGS);

    // Build hash->ID maps for dbtable and dbrow
    const dbTableArchive = configIndex.getArchive(ConfigType.OSRS.dbTable);
    const dbRowArchive = configIndex.getArchive(ConfigType.OSRS.dbRow);

    console.log(`DbTable archive: ${dbTableArchive ? "found" : "not found"}`);
    console.log(`DbRow archive: ${dbRowArchive ? "found" : "not found"}`);

    // Get all file IDs (these are the config IDs)
    const dbTableIds = dbTableArchive ? Array.from(dbTableArchive.getFileIds()) : [];
    const dbRowIds = dbRowArchive ? Array.from(dbRowArchive.getFileIds()) : [];

    console.log(`DbTable count: ${dbTableIds.length}`);
    console.log(`DbRow count: ${dbRowIds.length}`);

    // Load known names from reference scripts
    const caseNames = loadCaseNamesFromReferenceScripts();
    console.log(`Loaded ${caseNames.length} case names from reference scripts`);

    // Build hash -> name map
    const hashToName = new Map<number, string>();
    for (const name of caseNames) {
        const hash = StringUtil.hashDjb2(name);
        hashToName.set(hash, name);
    }

    // Now build reference tables for dbTable and dbRow
    // The reference table stores nameHash for each archive
    const dbTableRefTable = configIndex.getReferenceTable();

    // For configs, we need to look at the archive's file references
    const dbTableNames: Record<number, string> = {};
    const dbRowNames: Record<number, string> = {};

    // Try to match case names to IDs by iterating through reference scripts
    // and finding switch_dbtable/switch_dbrow patterns with their case values

    // For now, let's just create a mapping based on known names
    // We'll hash each known name and if we have a matching ID in our range, use it

    // Actually, the better approach is to look at the archive reference nameHash
    if (dbTableArchive) {
        for (const fileId of dbTableArchive.getFileIds()) {
            // Check if we have a name for this ID from the reference table
            // The nameHash is stored in the archive's file references
        }
    }

    // Since we can't directly get names from the cache (they're hashed),
    // let's create a names file that can be used for lookups
    // Format: name\n (one per line, will hash and compare)

    // Save dbtable names file
    const dbTableNamesFile = path.join(OUT_DIR, "dbtable-names.txt");
    const dbRowNamesFile = path.join(OUT_DIR, "dbrow-names.txt");
    const dbColumnNamesFile = path.join(OUT_DIR, "dbcolumn-names.json");

    // Get column names for db_getfield resolution
    const columnNames = loadDbColumnNamesFromReferenceScripts();

    // For now, write the case names as potential dbtable/dbrow names
    // These will be hashed and matched at runtime
    fs.writeFileSync(dbTableNamesFile, caseNames.join("\n"));
    fs.writeFileSync(dbRowNamesFile, caseNames.join("\n"));
    fs.writeFileSync(dbColumnNamesFile, JSON.stringify(Object.fromEntries(columnNames), null, 2));

    console.log(`\nSaved ${caseNames.length} names to ${dbTableNamesFile}`);
    console.log(`Saved ${caseNames.length} names to ${dbRowNamesFile}`);
    console.log(`Saved ${columnNames.size} table columns to ${dbColumnNamesFile}`);

    // Now let's try to build actual ID -> name mappings
    // by checking which names hash to which IDs

    // Build name -> hash lookup
    console.log("\nBuilding ID -> name mappings...");

    const dbTableIdToName: Record<number, string> = {};
    const dbRowIdToName: Record<number, string> = {};

    // For each known name, hash it and see if that hash appears as an archive ID
    // This is a heuristic - the cache uses djb2 hash for lookups

    // Actually, let me check the reference table more carefully
    if (dbTableArchive) {
        const ref = configIndex.getArchiveReference(ConfigType.OSRS.dbTable);
        console.log(`DbTable archive reference: nameHash=${ref?.nameHash}`);
    }

    // The issue is that config files don't have individual name hashes stored
    // The names come from external sources (like scripts that reference them)

    // Let's create a simple JSON mapping that maps known IDs to names
    // based on analyzing the reference scripts

    console.log("\nAnalyzing reference scripts for ID -> name mappings...");

    // We need to find patterns like:
    // switch_dbtable (...) { case sailing_boat: ... }
    // And somehow correlate with the numeric IDs

    // For now, let's output what we found
    console.log(
        `\nFound ${dbTableIds.length} dbtable IDs: ${dbTableIds.slice(0, 10).join(", ")}...`,
    );
    console.log(`Found ${dbRowIds.length} dbrow IDs: ${dbRowIds.slice(0, 10).join(", ")}...`);

    console.log("\nDone!");
}

main().catch(console.error);
