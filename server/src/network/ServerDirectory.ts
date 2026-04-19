export interface ServerDirectoryEntry {
    name: string;
    address: string;
    secure: boolean;
    maxPlayers: number;
    playerCount: number;
    worldId?: string;
}

export interface BuildServerDirectoryOptions {
    serverName: string;
    maxPlayers: number;
    playerCount: number;
    worldId?: string;
    host: string;
    forwardedHost?: string;
    forwardedProto?: string;
    encrypted?: boolean;
}

function normalizeHost(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    return normalized.split(",")[0]?.trim() || undefined;
}

function inferSecure(options: BuildServerDirectoryOptions): boolean {
    const forwardedProto = options.forwardedProto?.trim().toLowerCase();
    if (forwardedProto === "https" || forwardedProto === "wss") {
        return true;
    }
    if (forwardedProto === "http" || forwardedProto === "ws") {
        return false;
    }
    return options.encrypted === true;
}

export function buildServerDirectoryEntries(
    options: BuildServerDirectoryOptions,
): ServerDirectoryEntry[] {
    const address =
        normalizeHost(options.forwardedHost) ??
        normalizeHost(options.host) ??
        "localhost:43594";

    return [
        {
            name: options.serverName,
            address,
            secure: inferSecure(options),
            maxPlayers: Math.max(1, Math.floor(options.maxPlayers)),
            playerCount: Math.max(0, Math.floor(options.playerCount)),
            worldId: options.worldId,
        },
    ];
}
