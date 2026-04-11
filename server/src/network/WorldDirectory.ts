export interface WorldDirectoryEntry {
    id: number;
    name: string;
    address: string;
    secure: boolean;
    maxPlayers: number;
    playerCount: number | null;
    location: number;
    activity: string;
    properties: number;
    description?: string;
}

type BuildWorldDirectoryParams = {
    serverName: string;
    maxPlayers: number;
    playerCount: number;
    hostHeader?: string;
    forwardedProto?: string;
    publicWsUrl?: string;
    rawDirectoryJson?: string;
};

function normalizeAddress(
    rawAddress: unknown,
    secureOverride?: boolean,
): { address: string; secure: boolean } | undefined {
    if (typeof rawAddress !== "string") {
        return undefined;
    }

    const trimmed = rawAddress.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    const match = trimmed.match(/^(wss?|https?):\/\/(.+)$/i);
    if (match) {
        const [, scheme, rest] = match;
        const address = rest.replace(/\/.*$/, "");
        if (address.length === 0) {
            return undefined;
        }
        return {
            address,
            secure: typeof secureOverride === "boolean" ? secureOverride : /^(wss|https)$/i.test(scheme),
        };
    }

    const address = trimmed.replace(/\/.*$/, "");
    if (address.length === 0) {
        return undefined;
    }

    return {
        address,
        secure: secureOverride ?? false,
    };
}

function normalizeInteger(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function makeFallbackEntry(params: BuildWorldDirectoryParams): WorldDirectoryEntry {
    const parsedPublicUrl = normalizeAddress(params.publicWsUrl);
    const address = parsedPublicUrl?.address ?? params.hostHeader?.trim() ?? "localhost:43594";
    const secure = parsedPublicUrl?.secure
        ?? (typeof params.forwardedProto === "string" ? /https/i.test(params.forwardedProto) : false);

    return {
        id: 1,
        name: params.serverName,
        address,
        secure,
        maxPlayers: Math.max(0, params.maxPlayers | 0),
        playerCount: Math.max(0, params.playerCount | 0),
        location: 0,
        activity: params.serverName,
        properties: 0,
        description: "Primary world served by this game application.",
    };
}

function normalizeWorldDirectoryEntries(rawEntries: unknown): WorldDirectoryEntry[] {
    if (!Array.isArray(rawEntries)) {
        return [];
    }

    const normalized: WorldDirectoryEntry[] = [];
    const seen = new Set<string>();
    let nextGeneratedId = 1;

    for (const value of rawEntries) {
        if (!value || typeof value !== "object") {
            continue;
        }

        const entry = value as Record<string, unknown>;
        const parsed = normalizeAddress(entry.address, typeof entry.secure === "boolean" ? entry.secure : undefined);
        if (!parsed) {
            continue;
        }

        const key = `${parsed.secure ? "wss" : "ws"}://${parsed.address.toLowerCase()}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        let id = normalizeInteger(entry.id, 0);
        if (id <= 0) {
            id = nextGeneratedId++;
        } else {
            nextGeneratedId = Math.max(nextGeneratedId, id + 1);
        }

        normalized.push({
            id,
            name: typeof entry.name === "string" && entry.name.trim().length > 0 ? entry.name.trim() : `World ${id}`,
            address: parsed.address,
            secure: parsed.secure,
            maxPlayers: Math.max(0, normalizeInteger(entry.maxPlayers, 2047)),
            playerCount: null,
            location: Math.max(0, normalizeInteger(entry.location, 0)),
            activity:
                typeof entry.activity === "string" && entry.activity.trim().length > 0
                    ? entry.activity.trim()
                    : "-",
            properties: Math.max(0, normalizeInteger(entry.properties, 0)),
            description:
                typeof entry.description === "string" && entry.description.trim().length > 0
                    ? entry.description.trim()
                    : undefined,
        });
    }

    return normalized;
}

export function buildWorldDirectory(params: BuildWorldDirectoryParams): WorldDirectoryEntry[] {
    const fallbackEntry = makeFallbackEntry(params);
    const rawDirectoryJson = params.rawDirectoryJson?.trim();
    if (!rawDirectoryJson) {
        return [fallbackEntry];
    }

    try {
        const normalized = normalizeWorldDirectoryEntries(JSON.parse(rawDirectoryJson));
        return normalized.length > 0 ? normalized : [fallbackEntry];
    } catch {
        return [fallbackEntry];
    }
}
