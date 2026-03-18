import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { IndexType } from "../../src/rs/cache/IndexType";
import {
    ArchiveEnumTypeLoader,
    IndexEnumTypeLoader,
} from "../../src/rs/config/enumtype/EnumTypeLoader";
import { initCacheEnv } from "../src/world/CacheEnv";

const NAME_TO_CANON: Record<string, string> = {
    yes: "emote_yes",
    no: "emote_no",
    bow: "emote_bow",
    angry: "emote_angry",
    think: "emote_think",
    wave: "emote_wave",
    shrug: "emote_shrug",
    cheer: "emote_cheer",
    beckon: "emote_beckon",
    laugh: "emote_laugh",
    "jump for joy": "emote_jump_with_joy",
    yawn: "emote_yawn",
    dance: "emote_dance",
    jig: "emote_dance_scottish",
    spin: "emote_dance_spin",
    headbang: "emote_dance_headbang",
    cry: "emote_cry",
    "blow kiss": "emote_blow_kiss",
    panic: "emote_panic",
    raspberry: "emote_ya_boo_sucks",
    clap: "emote_clap",
    salute: "emote_fremmenik_salute",
    "glass box": "emote_glass_box",
    "climb rope": "emote_climbing_rope",
    lean: "emote_mime_lean",
    "glass wall": "emote_glass_wall",
    idea: "emote_lightbulb",
    stamp: "emote_stampfeet",
    flap: "peng_emote_flap",
    "slap head": "emote_slap_head",
    "zombie walk": "zombie_walk_emote",
    scared: "terrified_emote",
    "rabbit hop": "rabbit_emote",
    explore: "emote_explore",
    trick: "emote_trick",
    sit: "emote_sit",
    "sit down": "emote_sit",
    flex: "emote_flex",
    party: "emote_party",
    "air guitar": "emote_air_guitar",
    jog: "emote_run_on_spot",
    "sit up": "emote_situps_5",
    "push up": "emote_pushups_5",
    "star jump": "emote_starjump_5",
    "zombie hand": "hw07_arm_from_the_ground_emote",
    "hypermobile drinker": "ash_emote",
    "premier shield": "premier_club_emote",
    "relic unlock": "league03_area_unlock_emote_player",
    "uri transform": "emote_uri_briefcase",
    "smooth dance": "emote_dance_loop",
    "crazy dance": "human_emote_crabdance",
};

const EMOTE_NAME_TO_SEQ: Record<string, number> = {
    emote_yes: 855,
    emote_no: 856,
    emote_think: 857,
    emote_bow: 858,
    emote_angry: 859,
    emote_cry: 860,
    emote_laugh: 861,
    emote_cheer: 862,
    emote_wave: 863,
    emote_beckon: 864,
    emote_clap: 865,
    emote_dance: 866,
    emote_run_on_spot: 868,
    emote_starjump_5: 870,
    emote_pushups_5: 872,
    emote_situps_5: 874,
    emote_glass_wall: 1128,
    emote_mime_lean: 1129,
    emote_climbing_rope: 1130,
    emote_glass_box: 1131,
    emote_blow_kiss: 1374,
    hw07_arm_from_the_ground_emote: 1708,
    emote_panic: 2105,
    emote_dance_scottish: 2106,
    emote_dance_spin: 2107,
    emote_dance_headbang: 2108,
    emote_jump_with_joy: 2109,
    emote_ya_boo_sucks: 2110,
    emote_yawn: 2111,
    emote_fremmenik_salute: 2112,
    emote_shrug: 2113,
    terrified_emote: 2836,
    zombie_walk_emote: 3544,
    emote_slap_head: 4275,
    emote_lightbulb: 4276,
    emote_stampfeet: 4278,
    emote_panic_flap: 4280,
    emote_air_guitar: 4751,
    emote_uri_briefcase: 7278,
    emote_uri_invisible: 7279,
    ash_emote: 7131,
    premier_club_emote: 7751,
    emote_explore: 8541,
    league03_area_unlock_emote_player: 9208,
    emote_trick: 10503,
    emote_dance_loop: 10048,
    human_emote_crabdance: 10051,
    emote_party: 10031,
    rabbit_emote: 6111,
    emote_flex: 8917,
};

function resolveSeqFromDisplayName(name: string): number | undefined {
    const key = name.trim().toLowerCase();
    const canon = NAME_TO_CANON[key];
    if (canon) return EMOTE_NAME_TO_SEQ[canon];
    // Known specials not in NAME_TO_CANON mapping
    if (key.includes("goblin")) return undefined; // handled by client suggestion or future map
    if (key === "skill cape") return undefined; // varies by cape
    if (key === "zombie dance") return undefined; // not in our reference list
    if (key === "premier shield") return EMOTE_NAME_TO_SEQ["premier_club_emote"];
    return undefined;
}

function loadEnum1000() {
    const env = initCacheEnv("caches");
    // Try RS2 enums, then DAT2 configs
    try {
        const idx = (env.cacheSystem as any).getIndex(IndexType.RS2.enums);
        const loader = new IndexEnumTypeLoader(env.info, idx);
        const e = loader.load(1000) as any;
        if (e?.outputCount) return { env, e };
    } catch {}
    const cfg = env.indices.configs;
    let archId = cfg.getArchiveId("enum");
    if (archId < 0) archId = 8;
    if (archId < 0) archId = 104;
    const arch = cfg.getArchive(archId);
    const loader = new ArchiveEnumTypeLoader(env.info, arch);
    const e = loader.load(1000) as any;
    if (e?.outputCount) return { env, e };
    throw new Error("enum_1000 not found");
}

function generate(): string {
    const { e } = loadEnum1000();
    const keys: number[] = e.keys;
    const names: string[] = (e.stringValues || e.strValues) as any;
    const pairs = keys.map((k, i) => ({ index: k, name: String(names?.[i] ?? "") }));
    let out = `// Auto-generated from cache enum_1000 and reference name-to-seq mapping.\n`;
    out += `// Unmapped entries fall back to client-suggested seq at runtime.\n\n`;
    out += `export const EMOTE_SEQ_MAP: Partial<Record<number, number>> = {\n`;
    const lines: string[] = [];
    const comments: string[] = [];
    for (const p of pairs) {
        const seq = resolveSeqFromDisplayName(p.name);
        if (seq !== undefined) {
            lines.push(`  ${p.index}: ${seq}, // ${p.name}`);
        } else {
            comments.push(`  // ${p.index}: ?, // ${p.name}`);
        }
    }
    out += lines.join("\n") + (lines.length && comments.length ? "\n" : "");
    out += comments.join("\n") + "\n";
    out += `};\n\nexport function getEmoteSeq(index: number): number | undefined {\n  const id = EMOTE_SEQ_MAP[index];\n  return id !== undefined && id >= 0 ? id : undefined;\n}\n`;
    return out;
}

function main() {
    const content = generate();
    const target = path.resolve(process.cwd(), "server/src/game/emotes.ts");
    const prev = readFileSync(target, "utf-8");
    writeFileSync(target, content, "utf-8");
    console.log(`Wrote ${target}`);
}

main();
