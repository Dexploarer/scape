import { DEFAULT_SERVER } from "../../util/serverDefaults";

export interface WorldServerEntry {
    name: string;
    address: string;
    secure: boolean;
    playerCount: number | null;
    maxPlayers: number;
}

export interface WorldDirectoryEntry extends Omit<WorldServerEntry, "playerCount"> {
    id: number;
    playerCount: number;
    activity: string;
    location: number;
    properties: number;
}

const WORLD_ID_BASE = 301;
const DEFAULT_MAX_PLAYERS = 2047;

const WORLD_DIRECTORY_ENV = {
    REACT_APP_SECONDARY_WS_URL: process.env.REACT_APP_SECONDARY_WS_URL,
    REACT_APP_WORLD_2_WS_URL: process.env.REACT_APP_WORLD_2_WS_URL,
    REACT_APP_SECONDARY_SERVER_NAME: process.env.REACT_APP_SECONDARY_SERVER_NAME,
    REACT_APP_WORLD_2_SERVER_NAME: process.env.REACT_APP_WORLD_2_SERVER_NAME,
} as const;

function readEnv(key: keyof typeof WORLD_DIRECTORY_ENV): string | undefined {
    const value = WORLD_DIRECTORY_ENV[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseWsUrl(raw: string): { address: string; secure: boolean } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(wss?|https?):\/\/(.+)$/i);
    if (match) {
        const [, scheme, rest] = match;
        const address = rest.replace(/\/.*$/, "");
        if (!address) return null;
        return { address, secure: /^(wss|https)$/i.test(scheme) };
    }
    const address = trimmed.replace(/\/.*$/, "");
    if (!address) return null;
    return { address, secure: false };
}

function createDefaultServerEntries(): WorldServerEntry[] {
    const entries: WorldServerEntry[] = [
        {
            name: DEFAULT_SERVER.name,
            address: DEFAULT_SERVER.address,
            secure: DEFAULT_SERVER.secure,
            playerCount: null,
            maxPlayers: DEFAULT_MAX_PLAYERS,
        },
    ];

    const secondaryUrl =
        readEnv("REACT_APP_SECONDARY_WS_URL") ?? readEnv("REACT_APP_WORLD_2_WS_URL");
    const secondaryName =
        readEnv("REACT_APP_SECONDARY_SERVER_NAME") ??
        readEnv("REACT_APP_WORLD_2_SERVER_NAME") ??
        "Toonscape";
    const parsedSecondary = secondaryUrl ? parseWsUrl(secondaryUrl) : null;
    if (parsedSecondary) {
        entries.push({
            name: secondaryName,
            address: parsedSecondary.address,
            secure: parsedSecondary.secure,
            playerCount: null,
            maxPlayers: DEFAULT_MAX_PLAYERS,
        });
    }

    return entries;
}

function normalizeServerEntry(raw: Partial<WorldServerEntry> | null | undefined): WorldServerEntry | null {
    if (!raw) return null;
    const address = typeof raw.address === "string" ? raw.address.trim() : "";
    if (!address) return null;
    const name = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : address;
    const secure = raw.secure === true;
    const maxPlayers =
        typeof raw.maxPlayers === "number" && Number.isFinite(raw.maxPlayers) && raw.maxPlayers > 0
            ? Math.floor(raw.maxPlayers)
            : DEFAULT_MAX_PLAYERS;
    const playerCount =
        typeof raw.playerCount === "number" && Number.isFinite(raw.playerCount)
            ? Math.floor(raw.playerCount)
            : null;
    return {
        name,
        address,
        secure,
        playerCount,
        maxPlayers,
    };
}

function dedupeServers(entries: Array<Partial<WorldServerEntry> | null | undefined>): WorldServerEntry[] {
    const deduped = new Map<string, WorldServerEntry>();
    for (const entry of entries) {
        const normalized = normalizeServerEntry(entry);
        if (!normalized) continue;
        const key = `${normalized.secure ? "wss" : "ws"}://${normalized.address.toLowerCase()}`;
        const existing = deduped.get(key);
        if (!existing) {
            deduped.set(key, normalized);
            continue;
        }
        deduped.set(key, {
            ...existing,
            ...normalized,
            playerCount:
                normalized.playerCount !== null ? normalized.playerCount : existing.playerCount,
        });
    }
    return [...deduped.values()];
}

let configuredServers: WorldServerEntry[] = dedupeServers(createDefaultServerEntries());

export function setConfiguredWorldServers(
    entries: Array<Partial<WorldServerEntry> | null | undefined>,
): WorldServerEntry[] {
    const merged = dedupeServers([...entries, ...createDefaultServerEntries()]);
    if (merged.length > 0) {
        configuredServers = merged;
    }
    return configuredServers;
}

export function getConfiguredWorldServers(): readonly WorldServerEntry[] {
    return configuredServers;
}

function normalizeWorldPopulation(playerCount: number | null): number {
    if (playerCount === null) return -1;
    if (playerCount < 0) return 0;
    return playerCount | 0;
}

export function getConfiguredWorlds(): WorldDirectoryEntry[] {
    return configuredServers.map((server, index) => ({
        ...server,
        id: WORLD_ID_BASE + index,
        activity: server.name,
        location: 0,
        properties: 0,
        playerCount: normalizeWorldPopulation(server.playerCount),
    }));
}

export function findConfiguredWorldById(worldId: number): WorldDirectoryEntry | undefined {
    return getConfiguredWorlds().find((world) => (world.id | 0) === (worldId | 0));
}

export function findConfiguredWorldByServer(
    address: string,
    secure: boolean,
): WorldDirectoryEntry | undefined {
    const normalizedAddress = address.trim().toLowerCase();
    return getConfiguredWorlds().find(
        (world) => world.secure === secure && world.address.trim().toLowerCase() === normalizedAddress,
    );
}

export function getNextConfiguredWorld(
    address: string,
    secure: boolean,
): WorldDirectoryEntry | undefined {
    const worlds = getConfiguredWorlds();
    if (worlds.length < 2) return undefined;
    const currentIndex = worlds.findIndex(
        (world) => world.secure === secure && world.address.trim().toLowerCase() === address.trim().toLowerCase(),
    );
    const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
    return worlds[(normalizedIndex + 1) % worlds.length];
}

export function getWorldSwitcherButtonText(address: string, secure: boolean): string {
    const nextWorld = getNextConfiguredWorld(address, secure);
    if (!nextWorld) {
        return "World Switcher";
    }
    return `Switch to ${nextWorld.name}`;
}
