import { readFileSync } from "fs";
import { resolve } from "path";

import { logger } from "../utils/logger";

export interface ServerConfig {
    host: string;
    port: number;
    tickMs: number;
    runtimeMode: "development" | "production";
    worldId: string;
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
     * Allow the JSON account store in production mode.
     *
     * Default false because hosted deployments typically replace the
     * local filesystem on each app update.
     */
    allowJsonAccountStoreInProduction: boolean;
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
    /**
     * Shared HMAC secret for hosted Milady/ElizaOS login tickets.
     * Empty = hosted session mode disabled.
     */
    hostedSessionSecret: string;
    /** Shared backend / control-plane connection details (future SpacetimeDB path). */
    spacetimeUri?: string;
    spacetimeDatabase?: string;
    spacetimeAuthToken?: string;
    /**
     * Optional JSONL sink for autonomous-agent trajectories.
     * Empty = disable local file export.
     */
    trajectoryLogPath?: string;
}

export type ServerRuntimeMode = "development" | "production";

type ServerConfigFile = Partial<
    Pick<
        ServerConfig,
        | "serverName"
        | "maxPlayers"
        | "gamemode"
        | "worldId"
        | "accountsFilePath"
        | "minPasswordLength"
        | "allowJsonAccountFallback"
        | "allowJsonAccountStoreInProduction"
        | "allowedOrigins"
        | "botSdkHost"
        | "botSdkPort"
        | "botSdkToken"
        | "botSdkPerceptionEveryNTicks"
        | "hostedSessionSecret"
        | "spacetimeUri"
        | "spacetimeDatabase"
        | "trajectoryLogPath"
    >
>;

function normalizeWorldId(value: string | undefined): string | undefined {
    const trimmed = value?.trim().toLowerCase();
    if (!trimmed) return undefined;
    const normalized = trimmed.replace(/[^a-z0-9:_-]+/g, "-").replace(/-+/g, "-");
    return normalized.length > 0 ? normalized : undefined;
}

function readServerConfigFile(): ServerConfigFile {
    try {
        const raw = readFileSync(resolve(__dirname, "../../config.json"), "utf-8");
        return JSON.parse(raw) as ServerConfigFile;
    } catch (err) {
        logger.info("[config] failed to load config.json", err);
        return {};
    }
}

function normalizeRuntimeMode(value: string | undefined): ServerRuntimeMode | undefined {
    const normalized = value?.trim().toLowerCase();
    if (normalized === "production") return "production";
    if (normalized === "development") return "development";
    return undefined;
}

function extractHostname(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
        const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
        return new URL(candidate).hostname.trim().toLowerCase();
    } catch {
        return "";
    }
}

function isLocalDevelopmentHost(hostname: string): boolean {
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.endsWith(".local")
    );
}

function isHostedAddress(value: string | undefined): boolean {
    if (!value?.trim()) return false;
    const hostname = extractHostname(value);
    return hostname.length > 0 && !isLocalDevelopmentHost(hostname);
}

export function resolveServerRuntimeMode(env: NodeJS.ProcessEnv = process.env): ServerRuntimeMode {
    const explicitMode = normalizeRuntimeMode(env.SERVER_RUNTIME_MODE);
    if (explicitMode) return explicitMode;

    const nodeEnvMode = normalizeRuntimeMode(env.NODE_ENV);
    if (nodeEnvMode) return nodeEnvMode;

    if (isHostedAddress(env.PUBLIC_WS_URL)) {
        return "production";
    }

    const allowedOrigins = env.ALLOWED_ORIGINS?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    if (allowedOrigins?.some((origin) => isHostedAddress(origin))) {
        return "production";
    }

    return "development";
}

export function createServerConfig(options: {
    env?: NodeJS.ProcessEnv;
    fileConfig?: ServerConfigFile;
} = {}): ServerConfig {
    const env = options.env ?? process.env;
    const parsed = options.fileConfig ?? readServerConfigFile();
    const portEnv = env.PORT?.trim();
    const tickMsEnv = env.TICK_MS?.trim();
    const runtimeMode = resolveServerRuntimeMode(env);

    let serverName = "Local Development";
    let maxPlayers = 2047;
    let gamemode = "vanilla";
    let worldId = "vanilla";
    let accountsFilePath = resolve(__dirname, "../../data/accounts.json");
    let minPasswordLength = 8;
    let allowJsonAccountFallback = false;
    let allowJsonAccountStoreInProduction = false;
    let allowedOrigins: string[] = [];
    let botSdkHost = "127.0.0.1";
    let botSdkPort = 43595;
    let botSdkToken = "";
    let botSdkPerceptionEveryNTicks = 3;
    let hostedSessionSecret = "";
    let spacetimeUri: string | undefined;
    let spacetimeDatabase: string | undefined;
    let trajectoryLogPath: string | undefined;

    if (typeof parsed.serverName === "string") serverName = parsed.serverName;
    if (typeof parsed.maxPlayers === "number") maxPlayers = parsed.maxPlayers;
    if (typeof parsed.gamemode === "string") gamemode = parsed.gamemode;
    if (typeof parsed.worldId === "string") worldId = parsed.worldId;
    if (typeof parsed.accountsFilePath === "string") {
        accountsFilePath = resolve(__dirname, "../../", parsed.accountsFilePath);
    }
    if (typeof parsed.minPasswordLength === "number") minPasswordLength = parsed.minPasswordLength;
    if (typeof parsed.allowJsonAccountFallback === "boolean") {
        allowJsonAccountFallback = parsed.allowJsonAccountFallback;
    }
    if (typeof parsed.allowJsonAccountStoreInProduction === "boolean") {
        allowJsonAccountStoreInProduction = parsed.allowJsonAccountStoreInProduction;
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
    if (typeof parsed.hostedSessionSecret === "string") {
        hostedSessionSecret = parsed.hostedSessionSecret;
    }
    if (typeof parsed.spacetimeUri === "string") spacetimeUri = parsed.spacetimeUri;
    if (typeof parsed.spacetimeDatabase === "string") {
        spacetimeDatabase = parsed.spacetimeDatabase;
    }
    if (typeof parsed.trajectoryLogPath === "string") {
        trajectoryLogPath = resolve(__dirname, "../../", parsed.trajectoryLogPath);
    }

    // Env vars override config.json
    if (env.SERVER_NAME?.trim()) serverName = env.SERVER_NAME.trim();
    if (env.WORLD_ID?.trim()) worldId = env.WORLD_ID.trim();
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
    if (env.ALLOW_JSON_ACCOUNT_STORE_IN_PRODUCTION?.trim()) {
        const normalizedAllowJsonInProduction =
            env.ALLOW_JSON_ACCOUNT_STORE_IN_PRODUCTION.trim().toLowerCase();
        allowJsonAccountStoreInProduction =
            normalizedAllowJsonInProduction === "1" ||
            normalizedAllowJsonInProduction === "true" ||
            normalizedAllowJsonInProduction === "yes";
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
    if (env.HOSTED_SESSION_SECRET?.trim()) {
        hostedSessionSecret = env.HOSTED_SESSION_SECRET.trim();
    }
    if (env.SPACETIMEDB_URI?.trim()) {
        spacetimeUri = env.SPACETIMEDB_URI.trim();
    }
    if (env.SPACETIMEDB_DATABASE?.trim()) {
        spacetimeDatabase = env.SPACETIMEDB_DATABASE.trim();
    }
    const spacetimeAuthToken = env.SPACETIMEDB_AUTH_TOKEN?.trim() || undefined;
    if (env.TRAJECTORY_LOG_PATH?.trim()) {
        trajectoryLogPath = resolve(env.TRAJECTORY_LOG_PATH.trim());
    }

    const resolvedWorldId = normalizeWorldId(worldId) ?? normalizeWorldId(gamemode) ?? "vanilla";

    return {
        // Bind all interfaces by default so LAN/mobile clients can reach the WS server.
        host: env.HOST || "0.0.0.0",
        port: portEnv ? parseInt(portEnv, 10) || 43594 : 43594, // classic RuneScape default port
        tickMs: tickMsEnv ? parseInt(tickMsEnv, 10) || 600 : 600, // 0.6s tick
        runtimeMode,
        worldId: resolvedWorldId,
        serverName,
        maxPlayers,
        gamemode: env.GAMEMODE || gamemode,
        accountsFilePath,
        minPasswordLength,
        allowJsonAccountFallback,
        allowJsonAccountStoreInProduction,
        allowedOrigins,
        botSdkEnabled: botSdkToken.length > 0,
        botSdkHost,
        botSdkPort,
        botSdkToken,
        botSdkPerceptionEveryNTicks,
        hostedSessionSecret,
        spacetimeUri,
        spacetimeDatabase,
        spacetimeAuthToken,
        trajectoryLogPath,
    };
}

export const config: ServerConfig = createServerConfig();
