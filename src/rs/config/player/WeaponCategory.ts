import type { ObjType } from "../objtype/ObjType";

export const DEFAULT_WEAPON_CATEGORY = 0;

export interface WeaponCategoryHeuristic {
    pattern: RegExp;
    category: number;
    label?: string;
}

export const WEAPON_CATEGORY_HEURISTICS: WeaponCategoryHeuristic[] = [
    { pattern: /unarmed|fist|none/, category: 0, label: "Unarmed" },
    { pattern: /whip/, category: 20, label: "Whip" },
    { pattern: /dagger|claw|katana|sai/, category: 11, label: "Dagger / claw" },
    {
        pattern: /scimitar|sword|blade|rapier|sabre|cutlass|longsword/,
        category: 4,
        label: "Sword",
    },
    { pattern: /battleaxe|greataxe/, category: 10, label: "Battleaxe" },
    { pattern: /axe|hatchet/, category: 1, label: "Axe" },
    { pattern: /pickaxe/, category: 16, label: "Pickaxe" },
    { pattern: /mace|anchor/, category: 13, label: "Mace" },
    { pattern: /hammer|maul|club|warhammer|tzhaar-ket-om/, category: 2, label: "Blunt" },
    { pattern: /halberd|glaive|scythe|polearm/, category: 14, label: "Polearm" },
    { pattern: /hasta/, category: 25, label: "Hasta" },
    { pattern: /spear|pike|trident/, category: 15, label: "Spear" },
    { pattern: /staff|sceptre|cane/, category: 18, label: "Staff" },
    { pattern: /wand/, category: 24, label: "Staff (magic)" },
    { pattern: /bow|longbow|shortbow|blowpipe/, category: 3, label: "Bow" },
    { pattern: /ballista|chin(chompa)?/, category: 7, label: "Chinchompa" },
    { pattern: /crossbow|c'?bow/, category: 5, label: "Crossbow" },
    { pattern: /knife|dart|javelin|throw/, category: 19, label: "Thrown" },
    { pattern: /salamander/, category: 6, label: "Salamander" },
    { pattern: /flail/, category: 12, label: "Flail" },
    { pattern: /barrelchest|tzhaar-ket-om/, category: 2, label: "Blunt" },
];

type ResolveOptions = {
    availableCategories?: Iterable<number>;
    defaultCategory?: number;
};

function toAvailableSet(available: ResolveOptions["availableCategories"]): Set<number> | undefined {
    if (!available) return undefined;
    if (available instanceof Set) return available;
    const set = new Set<number>();
    for (const value of available) set.add(value | 0);
    return set;
}

function pickFallbackCategory(available: Set<number> | undefined, fallback: number): number {
    if (!available) return fallback;
    if (available.has(fallback)) return fallback;
    const first = available.values().next();
    return first.done ? fallback : first.value;
}

function matchesAvailable(category: number, available?: Set<number>): boolean {
    if (!available) return true;
    return available.has(category | 0);
}

export function resolveWeaponCategoryFromName(
    name: string | undefined,
    options?: ResolveOptions,
): number {
    const normalized = (name ?? "").toLowerCase();
    const available = toAvailableSet(options?.availableCategories);
    const fallback = options?.defaultCategory ?? DEFAULT_WEAPON_CATEGORY;

    if (!normalized.trim()) {
        return pickFallbackCategory(available, fallback);
    }

    for (const entry of WEAPON_CATEGORY_HEURISTICS) {
        if (entry.pattern.test(normalized) && matchesAvailable(entry.category, available)) {
            return entry.category;
        }
    }

    if (/staff|wand/.test(normalized) && matchesAvailable(18, available)) return 18;
    if (/bow/.test(normalized) && matchesAvailable(3, available)) return 3;
    if (/crossbow/.test(normalized) && matchesAvailable(5, available)) return 5;
    if (/whip/.test(normalized) && matchesAvailable(20, available)) return 20;

    return pickFallbackCategory(available, fallback);
}

export function resolveWeaponCategoryFromObj(
    obj: ObjType | undefined,
    options?: ResolveOptions,
): number {
    const name = typeof obj?.name === "string" ? obj.name : undefined;
    return resolveWeaponCategoryFromName(name, options);
}
