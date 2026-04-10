/**
 * Default WebSocket server configuration derived at build time.
 *
 * The client reaches the server via `ws://<host>:<port>` (or `wss://` when
 * deployed behind TLS). Historically this was hardcoded to `localhost:43594`,
 * which is fine for local dev but useless for a public deployment — every
 * user would need to type the address into the server-browser.
 *
 * We read the default from two CRA environment variables:
 *   - `REACT_APP_WS_URL` — full `ws://` / `wss://` URL (preferred)
 *   - `REACT_APP_SERVER_NAME` — display name shown in the server browser
 *
 * If `REACT_APP_WS_URL` is unset we fall back to the legacy localhost default.
 * For production builds, set these in `.env.production` before `bun run build`
 * and craco will inline them at build time.
 */

function readEnv(key: string): string | undefined {
    // CRA's webpack rewrites `process.env.REACT_APP_FOO` to a literal
    // at build time, even when `key` is a variable (the whole
    // `process.env` object is injected as a hardcoded literal object
    // that we then index into). That means `process.env[key]` never
    // actually hits the Node `process` global in the browser.
    //
    // Do NOT guard with `typeof process === "undefined"` here —
    // modern CRA builds do not ship a process polyfill, so in the
    // browser `typeof process === "undefined"` is `true`, the guard
    // returns early, and the inlined object lookup below is never
    // reached. The net effect is that DEFAULT_SERVER silently falls
    // back to the hardcoded localhost LOCAL_FALLBACK on every hosted
    // deployment, regardless of what REACT_APP_WS_URL is set to.
    // That bug took hours to track down — do not reintroduce the
    // `typeof process` guard.
    try {
        const value = (process as { env?: Record<string, string | undefined> })
            .env?.[key];
        return typeof value === "string" && value.length > 0 ? value : undefined;
    } catch {
        return undefined;
    }
}

export interface DefaultServer {
    /** `host:port` — no scheme. Matches the format used by LoginState.serverAddress. */
    address: string;
    /** True if the default URL uses `wss://` (TLS). */
    secure: boolean;
    /** Display name shown on the server-select button and in the server list. */
    name: string;
}

function parseWsUrl(raw: string): { address: string; secure: boolean } | null {
    try {
        const trimmed = raw.trim();
        // Accept ws(s):// or http(s):// prefixes — the client only does WebSockets
        // but folks routinely paste http URLs, so we normalize.
        const match = trimmed.match(/^(wss?|https?):\/\/(.+)$/i);
        if (match) {
            const [, scheme, rest] = match;
            const secure = /^(wss|https)$/i.test(scheme);
            const address = rest.replace(/\/.*$/, ""); // strip any path
            if (!address) return null;
            return { address, secure };
        }
        // No scheme — assume ws:// and treat the whole thing as host:port.
        const address = trimmed.replace(/\/.*$/, "");
        if (!address) return null;
        return { address, secure: false };
    } catch {
        return null;
    }
}

const LOCAL_FALLBACK: DefaultServer = {
    address: "localhost:43594",
    secure: false,
    name: "Local Development",
};

export const DEFAULT_SERVER: DefaultServer = (() => {
    const rawUrl = readEnv("REACT_APP_WS_URL");
    const name = readEnv("REACT_APP_SERVER_NAME") ?? LOCAL_FALLBACK.name;
    if (!rawUrl) return { ...LOCAL_FALLBACK, name };
    const parsed = parseWsUrl(rawUrl);
    if (!parsed) return { ...LOCAL_FALLBACK, name };
    return { address: parsed.address, secure: parsed.secure, name };
})();

/** Full WebSocket URL (scheme + host:port) corresponding to {@link DEFAULT_SERVER}. */
export const DEFAULT_WS_URL = `${DEFAULT_SERVER.secure ? "wss" : "ws"}://${DEFAULT_SERVER.address}`;
