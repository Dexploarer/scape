export type AttackType = "melee" | "ranged" | "magic";

export function normalizeAttackType(value: unknown): AttackType | undefined {
    if (value === "melee" || value === "ranged" || value === "magic") {
        return value;
    }
    if (value !== undefined && value !== null) {
        const lower = String(value).toLowerCase();
        if (lower === "melee" || lower === "ranged" || lower === "magic") {
            return lower as AttackType;
        }
    }
    return undefined;
}
