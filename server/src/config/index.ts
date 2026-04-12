import { readFileSync } from "fs";
import { resolve } from "path";

import { logger } from "../utils/logger";

export interface ServerConfig {
    host: string;
    port: number;
    tickMs: number;
    runtimeMode: "development" | "production";
    serverName: string;
    maxPlayers: number;
    gamemode: string;
    /**
     * Path to the JSON file used by the default JsonAccountStore.
     * Defaults to `server/data/accounts.json` relative to server/src/config.
     */
    accountsFilePath: string;
    /** Minimum password length enforced at account creation. */
    minPasswordLength: number;
    /**
     * Allow a DATABASE_URL-backed deployment to fall back to the JSON
     * account store if Postgres initialization fails.
     *
     * Default false because hosted multi-user worlds should fail fast
     * instead of silently booting against ephemeral storage.
     */
    allowJsonAccountFallback: boolean;
    /**
     * Origin header allowlist for WebSocket upgrade. Empty = allow all
     * (convenient for LAN/dev). Populate this for public deployments.
     */
    allowedOrigins: string[];
    /**
     * Bot-SDK endpoint configuration (first-class agent integration).
     *
     * The bot-SDK runs on its own port (distinct from the human-client
     * binary protocol on `port`) and speaks TOON. It is disabled unless
     * {@link botSdkToken} is set — this is deliberate: an unauthenticated
     * agent endpoint on a public host is a game-state-write vulnerability.
     */
    botSdkEnabled: boolean;
    /** Bind host for the bot-SDK. Defaults to 127.0.0.1 (localhost-only). */
    botSdkHost: string;
    /** TCP port for the bot-SDK. Defaults to 43595. */
    botSdkPort: number;
    /** Shared secret. Empty = endpoint disabled. */
    botSdkToken: string;
    /** Emit perception every N game ticks. Default 3. */
    botSdkPerceptionEveryNTicks: number;
}

type ServerConfigFile = Partial<
    Pick<
        ServerConfig,
        | "serverName"
        | "maxPlayers"
        | "gamemode"
        | "accountsFilePath"
        | "minPasswordLength"
        | "allowJsonAccountFallback"
        | "allowedOrigins"
        | "botSdkHost"
        | "botSdkPort"
        | "botSdkToken"
        | "botSdkPerceptionEveryNTicks"
    >
>;

function readServerConfigFile(): ServerConfigFile {
    try {
        const raw = readFileSync(resolve(__dirname, "../../config.json"), "utf-8");
        return JSON.parse(raw) as ServerConfigFile;
    } catch (err) {
        logger.info("[config] failed to load config.json", err);
        return {};
    }
}

export function createServerConfig(options: {
    env?: NodeJS.ProcessEnv;
    fileConfig?: ServerConfigFile;
} = {}): ServerConfig {
    const env = options.env ?? process.env;
    const parsed = options.fileConfig ?? readServerConfigFile();
    const portEnv = env.PORT?.trim();
    const tickMsEnv = env.TICK_MS?.trim();
    const runtimeMode =
        env.NODE_ENV?.trim().toLowerCase() === "production"
            ? "production"
            : "development";

    let serverName = "Local Development";
    let maxPlayers = 2047;
    let gamemode = "vanilla";
    let accountsFilePath = resolve(__dirname, "../../data/accounts.json");
    let minPasswordLength = 8;
    let allowJsonAccountFallback = false;
    let allowedOrigins: string[] = [];
    let botSdkHost = "127.0.0.1";
    let botSdkPort = 43595;
    let botSdkToken = "";
    let botSdkPerceptionEveryNTicks = 3;

    if (typeof parsed.serverName === "string") serverName = parsed.serverName;
    if (typeof parsed.maxPlayers === "number") maxPlayers = parsed.maxPlayers;
    if (typeof parsed.gamemode === "string") gamemode = parsed.gamemode;
    if (typeof parsed.accountsFilePath === "string") {
        accountsFilePath = resolve(__dirname, "../../", parsed.accountsFilePath);
    }
    if (typeof parsed.minPasswordLength === "number") minPasswordLength = parsed.minPasswordLength;
    if (typeof parsed.allowJsonAccountFallback === "boolean") {
        allowJsonAccountFallback = parsed.allowJsonAccountFallback;
    }
    if (Array.isArray(parsed.allowedOrigins)) {
        allowedOrigins = parsed.allowedOrigins.filter((o: unknown): o is string => typeof o === "string");
    }
    if (typeof parsed.botSdkHost === "string") botSdkHost = parsed.botSdkHost;
    if (typeof parsed.botSdkPort === "number") botSdkPort = parsed.botSdkPort;
    if (typeof parsed.botSdkToken === "string") botSdkToken = parsed.botSdkToken;
    if (typeof parsed.botSdkPerceptionEveryNTicks === "number") {
        botSdkPerceptionEveryNTicks = parsed.botSdkPerceptionEveryNTicks;
    }

    // Env vars override config.json
    if (env.SERVER_NAME?.trim()) serverName = env.SERVER_NAME.trim();
    if (env.ACCOUNTS_FILE_PATH?.trim()) {
        accountsFilePath = resolve(env.ACCOUNTS_FILE_PATH.trim());
    }
    if (env.AUTH_MIN_PASSWORD_LENGTH?.trim()) {
        const parsedPasswordLength = parseInt(env.AUTH_MIN_PASSWORD_LENGTH.trim(), 10);
        if (Number.isFinite(parsedPasswordLength) && parsedPasswordLength > 0) {
            minPasswordLength = parsedPasswordLength;
        }
    }
    if (env.ALLOW_JSON_ACCOUNT_FALLBACK?.trim()) {
        const normalizedAllowFallback = env.ALLOW_JSON_ACCOUNT_FALLBACK.trim().toLowerCase();
        allowJsonAccountFallback =
            normalizedAllowFallback === "1" ||
            normalizedAllowFallback === "true" ||
            normalizedAllowFallback === "yes";
    }
    if (env.ALLOWED_ORIGINS?.trim()) {
        allowedOrigins = env.ALLOWED_ORIGINS.split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }
    if (env.BOT_SDK_HOST?.trim()) botSdkHost = env.BOT_SDK_HOST.trim();
    if (env.BOT_SDK_PORT?.trim()) {
        const parsedBotSdkPort = parseInt(env.BOT_SDK_PORT.trim(), 10);
        if (Number.isFinite(parsedBotSdkPort) && parsedBotSdkPort > 0) {
            botSdkPort = parsedBotSdkPort;
        }
    }
    if (env.BOT_SDK_TOKEN?.trim()) botSdkToken = env.BOT_SDK_TOKEN.trim();
    if (env.BOT_SDK_PERCEPTION_EVERY_N_TICKS?.trim()) {
        const parsedPerceptionTicks = parseInt(env.BOT_SDK_PERCEPTION_EVERY_N_TICKS.trim(), 10);
        if (Number.isFinite(parsedPerceptionTicks) && parsedPerceptionTicks > 0) {
            botSdkPerceptionEveryNTicks = parsedPerceptionTicks;
        }
    }

    return {
        // Bind all interfaces by default so LAN/mobile clients can reach the WS server.
        host: env.HOST || "0.0.0.0",
        port: portEnv ? parseInt(portEnv, 10) || 43594 : 43594, // classic RuneScape default port
        tickMs: tickMsEnv ? parseInt(tickMsEnv, 10) || 600 : 600, // 0.6s tick
        runtimeMode,
        serverName,
        maxPlayers,
        gamemode: env.GAMEMODE || gamemode,
        accountsFilePath,
        minPasswordLength,
        allowJsonAccountFallback,
        allowedOrigins,
        botSdkEnabled: botSdkToken.length > 0,
        botSdkHost,
        botSdkPort,
        botSdkToken,
        botSdkPerceptionEveryNTicks,
    };
}

export const config: ServerConfig = createServerConfig();
