import { readFileSync } from "fs";
import { resolve } from "path";

import { normalizeWorldScopeId } from "../game/state/PlayerSessionKeys";
import { logger } from "../utils/logger";

export interface ServerConfig {
    host: string;
    port: number;
    tickMs: number;
    serverName: string;
    maxPlayers: number;
    gamemode: string;
    worldId: string;
    /**
     * Path to the JSON file used by the default JsonAccountStore.
     * Defaults to `server/data/accounts.json` relative to server/src/config.
     */
    accountsFilePath: string;
    /** Minimum password length enforced at account creation. */
    minPasswordLength: number;
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
    /** Shared HMAC secret for hosted Milady/ElizaOS session tickets. */
    hostedSessionSecret: string;
}

export interface ServerConfigFileOverrides {
    serverName?: string;
    maxPlayers?: number;
    gamemode?: string;
    worldId?: string;
    accountsFilePath?: string;
    minPasswordLength?: number;
    allowedOrigins?: string[];
    botSdkHost?: string;
    botSdkPort?: number;
    botSdkToken?: string;
    botSdkPerceptionEveryNTicks?: number;
    hostedSessionSecret?: string;
}

function loadConfigFile(configPath = resolve(__dirname, "../../config.json")): ServerConfigFileOverrides {
    try {
        const raw = readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const overrides: ServerConfigFileOverrides = {};
        if (typeof parsed.serverName === "string") overrides.serverName = parsed.serverName;
        if (typeof parsed.maxPlayers === "number") overrides.maxPlayers = parsed.maxPlayers;
        if (typeof parsed.gamemode === "string") overrides.gamemode = parsed.gamemode;
        if (typeof parsed.worldId === "string") overrides.worldId = parsed.worldId;
        if (typeof parsed.accountsFilePath === "string") overrides.accountsFilePath = parsed.accountsFilePath;
        if (typeof parsed.minPasswordLength === "number") overrides.minPasswordLength = parsed.minPasswordLength;
        if (Array.isArray(parsed.allowedOrigins)) {
            overrides.allowedOrigins = parsed.allowedOrigins.filter(
                (origin: unknown): origin is string => typeof origin === "string",
            );
        }
        if (typeof parsed.botSdkHost === "string") overrides.botSdkHost = parsed.botSdkHost;
        if (typeof parsed.botSdkPort === "number") overrides.botSdkPort = parsed.botSdkPort;
        if (typeof parsed.botSdkToken === "string") overrides.botSdkToken = parsed.botSdkToken;
        if (typeof parsed.botSdkPerceptionEveryNTicks === "number") {
            overrides.botSdkPerceptionEveryNTicks = parsed.botSdkPerceptionEveryNTicks;
        }
        if (typeof parsed.hostedSessionSecret === "string") {
            overrides.hostedSessionSecret = parsed.hostedSessionSecret;
        }
        return overrides;
    } catch (err) {
        logger.info("[config] failed to load config.json", err);
        return {};
    }
}

export function createServerConfig(
    env: NodeJS.ProcessEnv = process.env,
    fileOverrides: ServerConfigFileOverrides = loadConfigFile(),
): ServerConfig {
    const portEnv = env.PORT?.trim();
    const tickMsEnv = env.TICK_MS?.trim();

    let serverName = fileOverrides.serverName ?? "Local Development";
    let maxPlayers = fileOverrides.maxPlayers ?? 2047;
    const gamemode = env.GAMEMODE?.trim() || fileOverrides.gamemode || "vanilla";
    let accountsFilePath = resolve(
        __dirname,
        "../../",
        fileOverrides.accountsFilePath ?? "data/accounts.json",
    );
    let minPasswordLength = fileOverrides.minPasswordLength ?? 8;
    let allowedOrigins = [...(fileOverrides.allowedOrigins ?? [])];
    let botSdkHost = fileOverrides.botSdkHost ?? "127.0.0.1";
    let botSdkPort = fileOverrides.botSdkPort ?? 43595;
    let botSdkToken = fileOverrides.botSdkToken ?? "";
    let botSdkPerceptionEveryNTicks = fileOverrides.botSdkPerceptionEveryNTicks ?? 3;
    let hostedSessionSecret = fileOverrides.hostedSessionSecret?.trim() ?? "";

    if (env.ACCOUNTS_FILE_PATH?.trim()) {
        accountsFilePath = resolve(env.ACCOUNTS_FILE_PATH.trim());
    }
    if (env.AUTH_MIN_PASSWORD_LENGTH?.trim()) {
        const parsed = parseInt(env.AUTH_MIN_PASSWORD_LENGTH.trim(), 10);
        if (Number.isFinite(parsed) && parsed > 0) minPasswordLength = parsed;
    }
    if (env.ALLOWED_ORIGINS?.trim()) {
        allowedOrigins = env.ALLOWED_ORIGINS.split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
    }
    if (env.BOT_SDK_HOST?.trim()) botSdkHost = env.BOT_SDK_HOST.trim();
    if (env.BOT_SDK_PORT?.trim()) {
        const parsed = parseInt(env.BOT_SDK_PORT.trim(), 10);
        if (Number.isFinite(parsed) && parsed > 0) botSdkPort = parsed;
    }
    if (env.BOT_SDK_TOKEN?.trim()) botSdkToken = env.BOT_SDK_TOKEN.trim();
    if (env.BOT_SDK_PERCEPTION_EVERY_N_TICKS?.trim()) {
        const parsed = parseInt(env.BOT_SDK_PERCEPTION_EVERY_N_TICKS.trim(), 10);
        if (Number.isFinite(parsed) && parsed > 0) botSdkPerceptionEveryNTicks = parsed;
    }
    if (env.HOSTED_SESSION_SECRET?.trim()) {
        hostedSessionSecret = env.HOSTED_SESSION_SECRET.trim();
    }

    const worldId =
        normalizeWorldScopeId(env.WORLD_ID?.trim() || fileOverrides.worldId || gamemode) ??
        "default";

    return {
        host: env.HOST || "0.0.0.0",
        port: portEnv ? parseInt(portEnv, 10) || 43594 : 43594,
        tickMs: tickMsEnv ? parseInt(tickMsEnv, 10) || 600 : 600,
        serverName,
        maxPlayers,
        gamemode,
        worldId,
        accountsFilePath,
        minPasswordLength,
        allowedOrigins,
        botSdkEnabled: botSdkToken.length > 0,
        botSdkHost,
        botSdkPort,
        botSdkToken,
        botSdkPerceptionEveryNTicks,
        hostedSessionSecret,
    };
}

export const config: ServerConfig = createServerConfig();
