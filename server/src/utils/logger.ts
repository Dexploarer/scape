import util from "util";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<Exclude<LogLevel, "silent">, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

function ts(): string {
    return new Date().toISOString();
}

function env(key: string): string {
    return String(process?.env?.[key] ?? "").trim();
}

function envBool(key: string, def = false): boolean {
    const v = env(key).toLowerCase();
    if (v === "" || v == null) return def;
    return v === "1" || v === "true" || v === "yes";
}

function parseLevel(): LogLevel {
    const raw = env("LOG_LEVEL").toLowerCase();
    if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error" || raw === "silent")
        return raw as LogLevel;
    // default to info
    return "info";
}

const MIN_LEVEL: LogLevel = parseLevel();
const JSON_MODE =
    envBool("LOG_JSON") || env("LOG_FORMAT").toLowerCase() === "json" || envBool("AGENT_LOG");

// Optional category filters: comma‑separated list
function parseList(v: string): string[] {
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

const INCLUDE = parseList(env("LOG_INCLUDE").toLowerCase());
const EXCLUDE = parseList(env("LOG_EXCLUDE").toLowerCase());

function levelEnabled(level: Exclude<LogLevel, "silent">): boolean {
    if (MIN_LEVEL === "silent") return false;
    return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL as Exclude<LogLevel, "silent">];
}

function detectCategory(args: unknown[]): string | undefined {
    if (!args.length) return undefined;
    const first = args[0];
    const firstText = first != null && first.constructor === String ? String(first) : "";
    const m = /^\s*\[([^\]]+)\]/.exec(firstText);
    if (m && m[1]) return m[1].toLowerCase();
    return undefined;
}

function categoryAllowed(category: string | undefined): boolean {
    const cat = (category || "").toLowerCase();
    if (INCLUDE.length > 0 && (cat === "" || !INCLUDE.includes(cat))) return false;
    if (EXCLUDE.length > 0 && cat !== "" && EXCLUDE.includes(cat)) return false;
    return true;
}

function emit(level: Exclude<LogLevel, "silent">, args: unknown[]): void {
    if (!levelEnabled(level)) return;
    const category = detectCategory(args);
    if (!categoryAllowed(category)) return;

    if (JSON_MODE) {
        const out: Record<string, unknown> = {
            time: ts(),
            level,
            category,
        };
        try {
            // Format a unified message string; also keep raw args for agents that prefer arrays
            out.message = util.format(...args);
            out.args = args;
        } catch {
            out.message = args
                .map((arg) =>
                    arg != null && arg.constructor === String ? String(arg) : util.inspect(arg),
                )
                .join(" ");
            out.args = args;
        }
        const line = JSON.stringify(out);
        if (level === "error") console.error(line);
        else if (level === "warn") console.warn(line);
        else console.log(line);
        return;
    }

    const prefix = `[${ts()}] [${level.toUpperCase()}]`;
    if (level === "error") console.error(prefix, ...args);
    else if (level === "warn") console.warn(prefix, ...args);
    else console.log(prefix, ...args);
}

export const logger = {
    info: (...args: unknown[]) => emit("info", args),
    warn: (...args: unknown[]) => emit("warn", args),
    error: (...args: unknown[]) => emit("error", args),
    debug: (...args: unknown[]) => emit("debug", args),
    // Create a tagged logger that injects a [tag] prefix automatically
    withTag(tag: string) {
        const prefix = `[${String(tag)}]`;
        return {
            info: (...args: unknown[]) => emit("info", [prefix, ...args]),
            warn: (...args: unknown[]) => emit("warn", [prefix, ...args]),
            error: (...args: unknown[]) => emit("error", [prefix, ...args]),
            debug: (...args: unknown[]) => emit("debug", [prefix, ...args]),
        } as const;
    },
};
