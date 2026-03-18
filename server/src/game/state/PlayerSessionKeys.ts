export function normalizePlayerAccountName(name: string | undefined): string | undefined {
    const normalized = (name ?? "").trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

export function buildPlayerSaveKey(name: string | undefined, id: number): string {
    return normalizePlayerAccountName(name) ?? `id:${id}`;
}
