import type { DefaultServer } from "../../util/serverDefaults";

export const DEVELOPMENT_SERVER_LIST_PATH = "/servers.development.json";
export const PRODUCTION_SERVER_LIST_PATH = "/servers.production.json";
const JSON_CONTENT_TYPE_PATTERN = /\b(application|text)\/([a-z0-9.+-]*\+)?json\b/i;

export interface ServerListSourceEntry {
    name?: string;
    address?: string;
    secure?: boolean;
    maxPlayers?: number;
}

function readEnv(key: string): string | undefined {
    if (typeof process === "undefined" || !process.env) return undefined;
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isLocalhostAddress(address: string): boolean {
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(address.trim());
}

export function buildDefaultServerDirectoryUrl(
    defaultServer: Pick<DefaultServer, "address" | "secure">,
): string {
    return `${defaultServer.secure ? "https" : "http"}://${defaultServer.address}/servers.json`;
}

export function getServerListUrls(
    defaultServer: Pick<DefaultServer, "address" | "secure">,
    explicitUrl: string | undefined = readEnv("REACT_APP_SERVER_LIST_URL"),
): string[] {
    if (explicitUrl) {
        return [explicitUrl];
    }

    if (!defaultServer.secure && isLocalhostAddress(defaultServer.address)) {
        return [DEVELOPMENT_SERVER_LIST_PATH];
    }

    return [
        PRODUCTION_SERVER_LIST_PATH,
        buildDefaultServerDirectoryUrl(defaultServer),
    ];
}

function isLikelyJsonContentType(contentType: string | null): boolean {
    return typeof contentType === "string" && JSON_CONTENT_TYPE_PATTERN.test(contentType);
}

async function parseServerListResponse(
    response: Pick<Response, "headers" | "text">,
): Promise<ServerListSourceEntry[] | undefined> {
    const contentType = response.headers.get("content-type");
    if (contentType && !isLikelyJsonContentType(contentType)) {
        return undefined;
    }

    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("<")) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? (parsed as ServerListSourceEntry[]) : undefined;
    } catch {
        return undefined;
    }
}

export async function loadServerListEntries(
    urls: string[],
    fetchImpl: typeof fetch = fetch,
): Promise<ServerListSourceEntry[]> {
    const entries: ServerListSourceEntry[] = [];

    for (const url of urls) {
        try {
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
            if (!response.ok) {
                continue;
            }

            const parsed = await parseServerListResponse(response);
            if (parsed && parsed.length > 0) {
                entries.push(...parsed);
            }
        } catch {
            // Try the next source.
        }
    }

    return entries;
}
