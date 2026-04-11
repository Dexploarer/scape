import { DEFAULT_SERVER } from "../../util/serverDefaults";

export interface ServerDirectoryEntry {
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

function readEnv(key: string): string | undefined {
    try {
        const value = (process as { env?: Record<string, string | undefined> }).env?.[key];
        return typeof value === "string" && value.length > 0 ? value : undefined;
    } catch {
        return undefined;
    }
}

export function createDefaultServerDirectoryUrl(
    defaultServer: Pick<typeof DEFAULT_SERVER, "address" | "secure"> = DEFAULT_SERVER,
    explicitUrl: string | undefined = readEnv("REACT_APP_SERVER_LIST_URL"),
): string {
    if (typeof explicitUrl === "string" && explicitUrl.length > 0) {
        return explicitUrl;
    }
    return `${defaultServer.secure ? "https" : "http"}://${defaultServer.address}/servers.json`;
}

export const DEFAULT_SERVER_DIRECTORY_URL = createDefaultServerDirectoryUrl();

export function appendCacheBustParam(url: string, token: string): string {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}cb=${encodeURIComponent(token)}`;
}

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

function makeServerKey(entry: Pick<ServerDirectoryEntry, "address" | "secure">): string {
    return `${entry.secure ? "wss" : "ws"}://${entry.address.toLowerCase()}`;
}

export function createDefaultServerDirectoryEntry(): ServerDirectoryEntry {
    return {
        id: 1,
        name: DEFAULT_SERVER.name,
        address: DEFAULT_SERVER.address,
        secure: DEFAULT_SERVER.secure,
        maxPlayers: 2047,
        playerCount: null,
        location: 0,
        activity: DEFAULT_SERVER.name,
        properties: 0,
        description: "Default world for this build.",
    };
}

export function normalizeServerDirectoryEntries(
    rawEntries: unknown,
    defaultEntry: ServerDirectoryEntry = createDefaultServerDirectoryEntry(),
): ServerDirectoryEntry[] {
    const normalized: ServerDirectoryEntry[] = [];
    const seenServerKeys = new Set<string>();
    const seenIds = new Set<number>();
    let nextGeneratedId = 1;

    const addEntry = (value: unknown): void => {
        if (!value || typeof value !== "object") {
            return;
        }

        const entry = value as Record<string, unknown>;
        const parsed = normalizeAddress(entry.address, typeof entry.secure === "boolean" ? entry.secure : undefined);
        if (!parsed) {
            return;
        }

        const key = makeServerKey({ address: parsed.address, secure: parsed.secure });
        if (seenServerKeys.has(key)) {
            return;
        }

        let id = normalizeInteger(entry.id, 0);
        if (id <= 0 || seenIds.has(id)) {
            while (seenIds.has(nextGeneratedId)) {
                nextGeneratedId++;
            }
            id = nextGeneratedId++;
        }

        seenIds.add(id);
        seenServerKeys.add(key);
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
    };

    if (Array.isArray(rawEntries)) {
        for (const entry of rawEntries) {
            addEntry(entry);
        }
    }

    const defaultKey = makeServerKey(defaultEntry);
    if (!seenServerKeys.has(defaultKey)) {
        let defaultId = defaultEntry.id;
        if (defaultId <= 0 || seenIds.has(defaultId)) {
            while (seenIds.has(nextGeneratedId)) {
                nextGeneratedId++;
            }
            defaultId = nextGeneratedId++;
        }
        normalized.unshift({ ...defaultEntry, id: defaultId });
    }

    return normalized.length > 0 ? normalized : [{ ...defaultEntry }];
}

export async function fetchServerDirectory(
    url: string = DEFAULT_SERVER_DIRECTORY_URL,
): Promise<ServerDirectoryEntry[]> {
    try {
        const response = await fetch(appendCacheBustParam(url, Date.now().toString(36)), {
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
        });
        if (!response.ok) {
            return normalizeServerDirectoryEntries([]);
        }
        return normalizeServerDirectoryEntries(await response.json());
    } catch {
        return normalizeServerDirectoryEntries([]);
    }
}

async function probeWebSocket(url: string, timeoutMs: number): Promise<boolean> {
    return await new Promise((resolve) => {
        let settled = false;
        const socket = new WebSocket(url);
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try {
                socket.close();
            } catch {}
            resolve(false);
        }, timeoutMs);

        socket.addEventListener("open", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                socket.close();
            } catch {}
            resolve(true);
        });

        socket.addEventListener("error", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(false);
        });
    });
}

export async function probeServerDirectory(
    entries: ServerDirectoryEntry[],
): Promise<ServerDirectoryEntry[]> {
    const nextEntries = entries.map((entry) => ({ ...entry }));

    await Promise.all(
        nextEntries.map(async (entry) => {
            const protocol = entry.secure ? "https" : "http";
            let httpOk = false;
            try {
                const response = await fetch(
                    appendCacheBustParam(`${protocol}://${entry.address}/status`, Date.now().toString(36)),
                    {
                        signal: AbortSignal.timeout(8000),
                        cache: "no-store",
                    },
                );
                if (response.ok) {
                    const data = await response.json();
                    entry.playerCount =
                        typeof data.playerCount === "number" ? Math.trunc(data.playerCount) : null;
                    if (typeof data.maxPlayers === "number") {
                        entry.maxPlayers = Math.max(0, Math.trunc(data.maxPlayers));
                    }
                    if (typeof data.serverName === "string" && data.serverName.trim().length > 0) {
                        entry.name = data.serverName.trim();
                    }
                    httpOk = true;
                }
            } catch {}

            if (!httpOk) {
                const wsProtocol = entry.secure ? "wss" : "ws";
                const alive = await probeWebSocket(`${wsProtocol}://${entry.address}`, 5000);
                entry.playerCount = alive ? -1 : null;
            }
        }),
    );

    return nextEntries;
}

export function createSelectedServerStorageValue(
    entry: Pick<ServerDirectoryEntry, "name" | "address" | "secure">,
): string {
    return JSON.stringify({
        name: entry.name,
        address: entry.address,
        secure: entry.secure,
    });
}
