import {
    normalizePlayerAccountName,
    normalizeWorldScopeId,
    parseScopedPlayerSaveKey,
} from "./PlayerSessionKeys";

export interface SaveIdentityHints {
    worldId?: string;
    displayName?: string;
    principalId?: string;
    worldCharacterId?: string;
    branchKind?: string;
}

export interface ResolvedSpacetimeStateIds {
    worldId: string;
    principalId: string;
    worldCharacterId: string;
    displayName: string;
    canonicalName: string;
    branchKind?: string;
}

function normalizeTokenSegment(value: string | undefined, fallback: string): string {
    return normalizeWorldScopeId(value) ?? fallback;
}

function toCanonicalName(displayName: string | undefined, fallback: string): string {
    return normalizePlayerAccountName(displayName) ?? fallback;
}

export function nowMicros(): bigint {
    return BigInt(Date.now()) * 1000n;
}

export function buildLocalPrincipalId(canonicalName: string): string {
    return `principal:login:${canonicalName}`;
}

export function buildLocalWorldCharacterId(
    worldId: string,
    branchKind: "name" | "id" | "anonymous",
    value: string,
): string {
    return `world-character:${worldId}:${branchKind}:${value}`;
}

export function resolveSpacetimeStateIds(
    saveKey: string,
    hints: SaveIdentityHints = {},
): ResolvedSpacetimeStateIds {
    const parsed = parseScopedPlayerSaveKey(saveKey);
    const worldId = normalizeWorldScopeId(hints.worldId) ?? parsed?.worldId ?? "default";

    if (hints.worldCharacterId) {
        const worldCharacterId = normalizeTokenSegment(hints.worldCharacterId, "anonymous");
        const canonicalName = toCanonicalName(hints.displayName, worldCharacterId);
        return {
            worldId,
            principalId:
                normalizeWorldScopeId(hints.principalId) ?? `principal:character:${worldCharacterId}`,
            worldCharacterId,
            displayName: hints.displayName?.trim() || canonicalName,
            canonicalName,
            branchKind: hints.branchKind ?? "hosted",
        };
    }

    if (parsed?.kind === "character") {
        const canonicalName = toCanonicalName(hints.displayName, parsed.worldCharacterId);
        return {
            worldId,
            principalId:
                normalizeWorldScopeId(hints.principalId) ??
                `principal:character:${parsed.worldCharacterId}`,
            worldCharacterId: parsed.worldCharacterId,
            displayName: hints.displayName?.trim() || canonicalName,
            canonicalName,
            branchKind: hints.branchKind ?? "hosted",
        };
    }

    if (parsed?.kind === "name") {
        return {
            worldId,
            principalId:
                normalizeWorldScopeId(hints.principalId) ?? buildLocalPrincipalId(parsed.name),
            worldCharacterId:
                normalizeWorldScopeId(hints.worldCharacterId) ??
                buildLocalWorldCharacterId(worldId, "name", parsed.name),
            displayName: hints.displayName?.trim() || parsed.name,
            canonicalName: parsed.name,
            branchKind: hints.branchKind ?? "local",
        };
    }

    if (parsed?.kind === "id") {
        const fallback = `id-${parsed.id}`;
        return {
            worldId,
            principalId:
                normalizeWorldScopeId(hints.principalId) ?? `principal:${worldId}:id:${parsed.id}`,
            worldCharacterId:
                normalizeWorldScopeId(hints.worldCharacterId) ??
                buildLocalWorldCharacterId(worldId, "id", String(parsed.id)),
            displayName: hints.displayName?.trim() || fallback,
            canonicalName: toCanonicalName(hints.displayName, fallback),
            branchKind: hints.branchKind ?? "local",
        };
    }

    const fallbackDisplay = hints.displayName?.trim() || "anonymous";
    const canonicalName = toCanonicalName(fallbackDisplay, "anonymous");
    return {
        worldId,
        principalId:
            normalizeWorldScopeId(hints.principalId) ?? `principal:${worldId}:anonymous`,
        worldCharacterId:
            normalizeWorldScopeId(hints.worldCharacterId) ??
            buildLocalWorldCharacterId(worldId, "anonymous", "anonymous"),
        displayName: fallbackDisplay,
        canonicalName,
        branchKind: hints.branchKind ?? "local",
    };
}
