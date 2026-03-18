import { IndexType } from "../../src/rs/cache/IndexType";
import {
    ArchiveEnumTypeLoader,
    IndexEnumTypeLoader,
} from "../../src/rs/config/enumtype/EnumTypeLoader";
import type { CacheEnv } from "../src/world/CacheEnv";
import { initCacheEnv } from "../src/world/CacheEnv";

function loadEnum1000(env: CacheEnv) {
    // Try RS2 enums then DAT2 configs
    try {
        const idx = (env.cacheSystem as any).getIndex(IndexType.RS2.enums);
        const loader = new IndexEnumTypeLoader(env.info, idx);
        const e = loader.load(1000) as any;
        if (e?.outputCount) return e;
    } catch {}
    const cfg = env.indices.configs;
    let archId = cfg.getArchiveId("enum");
    if (archId < 0) archId = 8;
    if (archId < 0) archId = 104;
    const arch = cfg.getArchive(archId);
    const loader = new ArchiveEnumTypeLoader(env.info, arch);
    const e = loader.load(1000) as any;
    if (e?.outputCount) return e;
    throw new Error("enum_1000 not found");
}

function main() {
    const env = initCacheEnv("caches");
    const e = loadEnum1000(env);
    const keys: number[] = e.keys;
    const names: string[] = (e.stringValues || e.strValues) as any;
    const pairs = keys.map((k, i) => ({ index: k, name: String(names?.[i] ?? "") }));
    pairs.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
    for (const p of pairs) console.log(`${p.index}\t${p.name}`);
    console.error(`Total ${pairs.length} emotes from enum_1000`);
}

main();
