export function normalizePlayerAccountName(name: string | undefined): string | undefined {
    const normalized = (name ?? "").trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

export function normalizeWorldScopeId(value: string | undefined): string | undefined {
    const normalized = (value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized.length > 0 ? normalized : undefined;
}

export interface ScopedPlayerSaveKeyOptions {
    worldId?: string;
    name?: string;
    id?: number;
    worldCharacterId?: string;
}

export function buildScopedPlayerSaveKey(options: ScopedPlayerSaveKeyOptions): string {
    const worldId = normalizeWorldScopeId(options.worldId) ?? "default";
    const worldCharacterId = normalizeWorldScopeId(options.worldCharacterId);
    if (worldCharacterId) {
        return `world:${worldId}:character:${worldCharacterId}`;
    }
    const normalizedName = normalizePlayerAccountName(options.name);
    if (normalizedName) {
        return `world:${worldId}:name:${normalizedName}`;
    }
    if (Number.isFinite(options.id)) {
        return `world:${worldId}:id:${Math.max(0, Math.floor(options.id!))}`;
    }
    return `world:${worldId}:anonymous`;
}

export function buildPlayerSaveKey(name: string | undefined, id: number): string {
    return normalizePlayerAccountName(name) ?? `id:${id}`;
}
