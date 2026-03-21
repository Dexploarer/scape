import type { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";

export interface CacheItemSearchEntry {
    itemId: number;
    name: string;
    normalizedName: string;
}

type ScoredCacheItemSearchEntry = {
    entry: CacheItemSearchEntry;
    score: number;
};

export function normalizeCacheItemSearchTerm(value: string | undefined): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export class CacheItemSearchIndex {
    private entries: CacheItemSearchEntry[] | undefined;

    constructor(private readonly objTypeLoader: ObjTypeLoader | undefined) {}

    search(query: string): CacheItemSearchEntry[] {
        const normalizedQuery = normalizeCacheItemSearchTerm(query);
        if (!this.objTypeLoader || normalizedQuery.length === 0) {
            return [];
        }

        const tokens = normalizedQuery.split(" ").filter((token) => token.length > 0);
        const scored: ScoredCacheItemSearchEntry[] = [];
        for (const entry of this.getEntries()) {
            const score = this.scoreEntry(entry, normalizedQuery, tokens);
            if (score <= Number.NEGATIVE_INFINITY) {
                continue;
            }
            scored.push({ entry, score });
        }

        scored.sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            if (left.entry.name.length !== right.entry.name.length) {
                return left.entry.name.length - right.entry.name.length;
            }
            return left.entry.itemId - right.entry.itemId;
        });

        return scored.map((result) => result.entry);
    }

    private getEntries(): CacheItemSearchEntry[] {
        if (this.entries) {
            return this.entries;
        }

        const loader = this.objTypeLoader;
        if (!loader) {
            this.entries = [];
            return this.entries;
        }

        const nextEntries: CacheItemSearchEntry[] = [];
        const count = Math.max(0, loader.getCount?.() ?? 0);
        for (let itemId = 0; itemId < count; itemId++) {
            let objType:
                | {
                      name?: string;
                      noteTemplate?: number;
                  }
                | undefined;
            try {
                objType = loader.load(itemId);
            } catch {
                objType = undefined;
            }
            if (!objType || this.isExcludedSearchVariant(objType)) {
                continue;
            }

            const name = String(objType.name ?? "").trim();
            if (name.length === 0 || name.toLowerCase() === "null") {
                continue;
            }

            const normalizedName = normalizeCacheItemSearchTerm(name);
            if (normalizedName.length === 0) {
                continue;
            }

            nextEntries.push({
                itemId,
                name,
                normalizedName,
            });
        }

        this.entries = nextEntries;
        return nextEntries;
    }

    private isExcludedSearchVariant(objType: { noteTemplate?: number }): boolean {
        return (objType.noteTemplate ?? -1) !== -1;
    }

    private scoreEntry(
        entry: CacheItemSearchEntry,
        normalizedQuery: string,
        tokens: string[],
    ): number {
        const normalizedName = entry.normalizedName;
        for (const token of tokens) {
            if (!normalizedName.includes(token)) {
                return Number.NEGATIVE_INFINITY;
            }
        }

        let score = 0;
        if (normalizedName === normalizedQuery) {
            score += 5000;
        }
        if (normalizedName.startsWith(normalizedQuery)) {
            score += 2500;
        }
        const wholePhraseIndex = normalizedName.indexOf(` ${normalizedQuery}`);
        if (wholePhraseIndex >= 0) {
            score += 1800 - Math.min(wholePhraseIndex, 1800);
        } else {
            const firstIndex = normalizedName.indexOf(normalizedQuery);
            if (firstIndex >= 0) {
                score += 1200 - Math.min(firstIndex, 1200);
            }
        }

        let tokenOrderScore = 0;
        let orderedTokenMatches = 0;
        let lastOrderedIndex = -1;
        for (const token of tokens) {
            const index = normalizedName.indexOf(token);
            if (index < 0) {
                return Number.NEGATIVE_INFINITY;
            }
            tokenOrderScore += Math.max(0, 200 - index);
            if (index >= lastOrderedIndex) {
                orderedTokenMatches++;
                lastOrderedIndex = index + token.length;
            }
        }
        score += tokenOrderScore;
        score += orderedTokenMatches * 50;
        score -= normalizedName.length;
        score -= Math.min(entry.itemId, 2000) / 10;
        return score;
    }
}
