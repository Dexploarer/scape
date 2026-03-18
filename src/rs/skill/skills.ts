export enum SkillId {
    Attack = 0,
    Defence = 1,
    Strength = 2,
    Hitpoints = 3,
    Ranged = 4,
    Prayer = 5,
    Magic = 6,
    Cooking = 7,
    Woodcutting = 8,
    Fletching = 9,
    Fishing = 10,
    Firemaking = 11,
    Crafting = 12,
    Smithing = 13,
    Mining = 14,
    Herblore = 15,
    Agility = 16,
    Thieving = 17,
    Slayer = 18,
    Farming = 19,
    Runecraft = 20,
    Hunter = 21,
    Construction = 22,
    Sailing = 23,
}

export const SKILL_DISPLAY_ORDER: SkillId[] = [
    SkillId.Attack,
    SkillId.Strength,
    SkillId.Defence,
    SkillId.Ranged,
    SkillId.Prayer,
    SkillId.Magic,
    SkillId.Runecraft,
    SkillId.Construction,
    SkillId.Hitpoints,
    SkillId.Agility,
    SkillId.Herblore,
    SkillId.Thieving,
    SkillId.Crafting,
    SkillId.Fletching,
    SkillId.Slayer,
    SkillId.Hunter,
    SkillId.Mining,
    SkillId.Smithing,
    SkillId.Fishing,
    SkillId.Cooking,
    SkillId.Firemaking,
    SkillId.Woodcutting,
    SkillId.Farming,
    SkillId.Sailing,
];

export const SKILL_COUNT = SKILL_DISPLAY_ORDER.length;
export const SKILL_IDS: readonly SkillId[] = Array.from(
    { length: SKILL_COUNT },
    (_, i) => i as SkillId,
);

export const SKILL_NAME: Record<SkillId, string> = {
    [SkillId.Attack]: "Attack",
    [SkillId.Strength]: "Strength",
    [SkillId.Defence]: "Defence",
    [SkillId.Hitpoints]: "Hitpoints",
    [SkillId.Ranged]: "Ranged",
    [SkillId.Prayer]: "Prayer",
    [SkillId.Magic]: "Magic",
    [SkillId.Cooking]: "Cooking",
    [SkillId.Woodcutting]: "Woodcutting",
    [SkillId.Fletching]: "Fletching",
    [SkillId.Fishing]: "Fishing",
    [SkillId.Firemaking]: "Firemaking",
    [SkillId.Crafting]: "Crafting",
    [SkillId.Smithing]: "Smithing",
    [SkillId.Mining]: "Mining",
    [SkillId.Herblore]: "Herblore",
    [SkillId.Agility]: "Agility",
    [SkillId.Thieving]: "Thieving",
    [SkillId.Slayer]: "Slayer",
    [SkillId.Farming]: "Farming",
    [SkillId.Runecraft]: "Runecraft",
    [SkillId.Hunter]: "Hunter",
    [SkillId.Construction]: "Construction",
    [SkillId.Sailing]: "Sailing",
};

export const MAX_REAL_LEVEL = 99;
export const MAX_VIRTUAL_LEVEL = 126;
export const MAX_XP = 200_000_000;

export const XP_TABLE: ReadonlyArray<number> = buildXpTable();

function buildXpTable(): number[] {
    const table: number[] = new Array(MAX_VIRTUAL_LEVEL + 2).fill(0);
    let points = 0;
    for (let level = 1; level <= MAX_VIRTUAL_LEVEL + 1; level++) {
        points += Math.floor(level + 300 * Math.pow(2, level / 7));
        table[level + 1] = Math.floor(points / 4);
    }
    table[0] = 0;
    table[1] = 0;
    return table;
}

export function getXpForLevel(level: number): number {
    const clamped = Math.min(Math.max(1, Math.floor(level)), MAX_VIRTUAL_LEVEL);
    return XP_TABLE[clamped] ?? XP_TABLE[XP_TABLE.length - 1];
}

export function getLevelForXp(xp: number, opts?: { virtual?: boolean }): number {
    const considerVirtual = opts?.virtual ?? true;
    const limit = considerVirtual ? MAX_VIRTUAL_LEVEL : MAX_REAL_LEVEL;
    const clampedXp = Math.min(Math.max(0, Math.floor(xp)), MAX_XP);
    for (let level = 1; level <= limit; level++) {
        if (clampedXp < XP_TABLE[level]) {
            return Math.max(1, level - 1);
        }
    }
    return limit;
}

export function getRemainingXp(xp: number, targetLevel: number): number {
    const goalXp = getXpForLevel(targetLevel);
    return Math.max(0, goalXp - Math.max(0, Math.floor(xp)));
}

export function getSkillName(id: SkillId): string {
    return SKILL_NAME[id] ?? `Skill ${id}`;
}
