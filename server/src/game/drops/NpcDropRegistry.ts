import type { NpcType } from "../../../../src/rs/config/npctype/NpcType";
import type { NpcTypeLoader } from "../../../../src/rs/config/npctype/NpcTypeLoader";
import { logger } from "../../utils/logger";
import { normalizeName, resolveDropTable } from "./helpers";
import { MANUAL_NPC_DROP_OVERRIDES } from "./manualTables";
import { loadMonstersCompleteDefinitions } from "./monstersCompleteSource";
import type { NpcDropTable } from "./types";

type ImportedLookup = {
    exact: Map<string, NpcDropTable>;
    byName: Map<string, NpcDropTable[]>;
};

function makeCombatKey(name: string, combatLevel: number | undefined): string {
    return `${normalizeName(name)}::${combatLevel ?? -1}`;
}

function buildImportedLookup(): ImportedLookup {
    const exact = new Map<string, NpcDropTable>();
    const byName = new Map<string, NpcDropTable[]>();
    for (const entry of loadMonstersCompleteDefinitions()) {
        // The bootstrap reference marks many otherwise-usable rows as incomplete.
        // Keep them available until a manual override replaces them.
        if (entry.duplicate) continue;
        const table = resolveDropTable(entry.table);
        if (!table) continue;
        const nameKey = normalizeName(entry.name);
        if (!nameKey) continue;
        const combatKey = makeCombatKey(entry.name, entry.combatLevel);
        if (!exact.has(combatKey)) exact.set(combatKey, table);
        const bucket = byName.get(nameKey) ?? [];
        bucket.push(table);
        byName.set(nameKey, bucket);
    }
    return { exact, byName };
}

export class NpcDropRegistry {
    private readonly resolvedByNpcTypeId = new Map<number, NpcDropTable | null>();
    private readonly manualByNpcTypeId = new Map<number, NpcDropTable>();
    private readonly imported = buildImportedLookup();

    constructor(private readonly npcTypeLoader: NpcTypeLoader) {
        for (const override of MANUAL_NPC_DROP_OVERRIDES) {
            const table = resolveDropTable(override.table);
            if (!table) continue;
            for (const npcTypeId of override.npcTypeIds) {
                this.manualByNpcTypeId.set(npcTypeId, table);
            }
        }
    }

    get(npcTypeId: number): NpcDropTable | undefined {
        const normalized = npcTypeId;
        const cached = this.resolvedByNpcTypeId.get(normalized);
        if (cached !== undefined) return cached ?? undefined;

        const manual = this.manualByNpcTypeId.get(normalized);
        if (manual) {
            this.resolvedByNpcTypeId.set(normalized, manual);
            return manual;
        }

        let npcType: NpcType | undefined;
        try {
            npcType = this.npcTypeLoader.load(normalized);
        } catch (err) {
            logger.warn(`[drops] failed to load npc type ${normalized} for drop lookup`, err);
            this.resolvedByNpcTypeId.set(normalized, null);
            return undefined;
        }
        const resolved = this.resolveImported(npcType);
        this.resolvedByNpcTypeId.set(normalized, resolved ?? null);
        return resolved;
    }

    private resolveImported(npcType: NpcType | undefined): NpcDropTable | undefined {
        const name = String(npcType?.name ?? "").trim();
        if (!name || name === "null") return undefined;
        const exact = this.imported.exact.get(makeCombatKey(name, npcType?.combatLevel));
        if (exact) return exact;
        const fallback = this.imported.byName.get(normalizeName(name));
        if (fallback?.length === 1) return fallback[0];
        return undefined;
    }
}
