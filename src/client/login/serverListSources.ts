import type { DefaultServer } from "../../util/serverDefaults";

export const DEVELOPMENT_SERVER_LIST_PATH = "/servers.development.json";
export const PRODUCTION_SERVER_LIST_PATH = "/servers.production.json";

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
