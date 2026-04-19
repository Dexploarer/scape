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

export type ScopedPlayerSaveKeyParseResult =
    | { worldId: string; kind: "character"; worldCharacterId: string }
    | { worldId: string; kind: "name"; name: string }
    | { worldId: string; kind: "id"; id: number }
    | { worldId: string; kind: "anonymous" };

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

export function parseScopedPlayerSaveKey(
    value: string | undefined,
): ScopedPlayerSaveKeyParseResult | undefined {
    const raw = (value ?? "").trim();
    if (!raw.startsWith("world:")) return undefined;
    const segments = raw.split(":");
    if (segments.length < 3) return undefined;
    const worldId = normalizeWorldScopeId(segments[1]);
    if (!worldId) return undefined;
    const kind = segments[2];
    switch (kind) {
        case "character": {
            const worldCharacterId = normalizeWorldScopeId(segments.slice(3).join(":"));
            if (!worldCharacterId) return undefined;
            return { worldId, kind, worldCharacterId };
        }
        case "name": {
            const name = normalizePlayerAccountName(segments.slice(3).join(":"));
            if (!name) return undefined;
            return { worldId, kind, name };
        }
        case "id": {
            const parsedId = Number.parseInt(segments[3] ?? "", 10);
            if (!Number.isFinite(parsedId) || parsedId < 0) return undefined;
            return { worldId, kind, id: Math.floor(parsedId) };
        }
        case "anonymous":
            return { worldId, kind };
        default:
            return undefined;
    }
}

export function buildPlayerSaveKey(name: string | undefined, id: number): string {
    return normalizePlayerAccountName(name) ?? `id:${id}`;
}
