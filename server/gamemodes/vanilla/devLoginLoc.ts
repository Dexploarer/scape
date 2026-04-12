export type DevLoginLocConfig = {
    locId: number;
    x: number;
    y: number;
    level: number;
    shape: number;
    rotation: number;
};

const DEFAULT_DEV_LOGIN_LOC_CONFIG: DevLoginLocConfig = {
    locId: 4387, // Saradomin Portal
    x: 3224,
    y: 3218,
    level: 0,
    shape: 10,
    rotation: 0,
};

function readEnvText(env: NodeJS.ProcessEnv, name: string): string | undefined {
    const raw = env[name];
    if (raw === undefined) {
        return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function readEnvInteger(env: NodeJS.ProcessEnv, name: string): number | undefined {
    const raw = readEnvText(env, name);
    if (raw === undefined || !/^[+-]?\d+$/.test(raw)) {
        return undefined;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function readEnabledFlag(env: NodeJS.ProcessEnv, name: string): boolean {
    const raw = readEnvText(env, name)?.toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function readDevLoginLocConfigFromEnv(
    env: NodeJS.ProcessEnv = process.env,
): DevLoginLocConfig | undefined {
    if (!readEnabledFlag(env, "SCAPE_DEV_LOGIN_LOC")) {
        return undefined;
    }

    const locId = readEnvInteger(env, "SCAPE_DEV_LOGIN_LOC_ID");
    const x = readEnvInteger(env, "SCAPE_DEV_LOGIN_LOC_X");
    const y = readEnvInteger(env, "SCAPE_DEV_LOGIN_LOC_Y");
    const level = readEnvInteger(env, "SCAPE_DEV_LOGIN_LOC_LEVEL");
    const shape = readEnvInteger(env, "SCAPE_DEV_LOGIN_LOC_SHAPE");
    const rotation = readEnvInteger(env, "SCAPE_DEV_LOGIN_LOC_ROTATION");

    return {
        locId: locId !== undefined && locId > 0 ? locId : DEFAULT_DEV_LOGIN_LOC_CONFIG.locId,
        x: x !== undefined ? x : DEFAULT_DEV_LOGIN_LOC_CONFIG.x,
        y: y !== undefined ? y : DEFAULT_DEV_LOGIN_LOC_CONFIG.y,
        level: level !== undefined && level >= 0 ? level : DEFAULT_DEV_LOGIN_LOC_CONFIG.level,
        shape: shape !== undefined && shape >= 0 ? shape : DEFAULT_DEV_LOGIN_LOC_CONFIG.shape,
        rotation: rotation !== undefined ? rotation & 0x3 : DEFAULT_DEV_LOGIN_LOC_CONFIG.rotation,
    };
}
