import fs from "fs";
import path from "path";

import {
    type LiveDirectorLoadedConfig,
    type LiveDirectorPhaseDurations,
    type LiveDirectorSeasonConfig,
    type LiveDirectorTemplateDefinition,
} from "../types";

type LiveDirectorSeasonJson = {
    promptVersion?: string;
    promptFile?: string;
    templateWeights?: Record<string, number>;
    disabledTemplates?: string[];
};

type LiveDirectorTemplateJson = {
    id?: string;
    category?: string;
    displayName?: string;
    announceText?: string;
    activeText?: string;
    completeText?: string;
    phaseDurations?: Partial<Record<keyof LiveDirectorPhaseDurations, number>>;
    cooldownTicks?: number;
    minOnlinePlayers?: number;
    maxConcurrent?: number;
    regions?: number[];
};

type LiveDirectorConfigJson = {
    enabled?: boolean;
    autoDirectorEnabled?: boolean;
    seasonId?: string;
    basePromptFile?: string;
    hotfixPromptFile?: string;
    evaluateIntervalTicks?: number;
    minOnlinePlayersForAutoStart?: number;
    maxConcurrentEvents?: number;
    templates?: LiveDirectorTemplateJson[];
    seasons?: Record<string, LiveDirectorSeasonJson>;
};

function expectString(value: string | undefined, key: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error(`[director] invalid string for ${key}`);
    }
    return trimmed;
}

function expectBoolean(value: boolean | undefined, key: string): boolean {
    if (value === undefined) {
        throw new Error(`[director] invalid boolean for ${key}`);
    }
    return value;
}

function expectInt(value: number | undefined, key: string, min: number): number {
    if (value === undefined || !Number.isFinite(value)) {
        throw new Error(`[director] invalid number for ${key}`);
    }
    const asInt = Math.trunc(value);
    if (asInt < min) {
        throw new Error(`[director] ${key} must be >= ${min}`);
    }
    return asInt;
}

function parsePhaseDurations(
    raw: Partial<Record<keyof LiveDirectorPhaseDurations, number>> | undefined,
    templateId: string,
): LiveDirectorPhaseDurations {
    const obj = raw ?? {};
    return {
        announce: expectInt(obj?.announce, `${templateId}.phaseDurations.announce`, 1),
        warmup: expectInt(obj?.warmup, `${templateId}.phaseDurations.warmup`, 1),
        active: expectInt(obj?.active, `${templateId}.phaseDurations.active`, 1),
        cooldown: expectInt(obj?.cooldown, `${templateId}.phaseDurations.cooldown`, 1),
        cleanup: expectInt(obj?.cleanup, `${templateId}.phaseDurations.cleanup`, 1),
    };
}

function parseTemplate(raw: LiveDirectorTemplateJson, index: number): LiveDirectorTemplateDefinition {
    const obj = raw;
    const templateId = expectString(obj?.id, `templates[${index}].id`);
    const minOnlinePlayers =
        obj?.minOnlinePlayers !== undefined
            ? expectInt(obj.minOnlinePlayers, `${templateId}.minOnlinePlayers`, 1)
            : undefined;
    const maxConcurrent =
        obj?.maxConcurrent !== undefined
            ? expectInt(obj.maxConcurrent, `${templateId}.maxConcurrent`, 1)
            : undefined;
    const regions =
        Array.isArray(obj?.regions) && obj.regions.length > 0
            ? obj.regions
                  .map((value, regionIndex) =>
                      expectInt(value, `${templateId}.regions[${regionIndex}]`, 0),
                  )
                  .filter((value) => value >= 0)
            : undefined;

    return {
        id: templateId,
        category: expectString(obj?.category, `${templateId}.category`),
        displayName: expectString(obj?.displayName, `${templateId}.displayName`),
        announceText: expectString(obj?.announceText, `${templateId}.announceText`),
        activeText: obj.activeText?.trim() || undefined,
        completeText: obj.completeText?.trim() || undefined,
        phaseDurations: parsePhaseDurations(obj?.phaseDurations, templateId),
        cooldownTicks: expectInt(obj?.cooldownTicks, `${templateId}.cooldownTicks`, 0),
        minOnlinePlayers,
        maxConcurrent,
        regions,
    };
}

function parseTemplateWeights(
    raw: Record<string, number> | undefined,
    seasonId: string,
    templateIds: ReadonlySet<string>,
): ReadonlyMap<string, number> {
    if (!raw) {
        return new Map<string, number>();
    }

    const output = new Map<string, number>();
    for (const [templateId, weightRaw] of Object.entries(raw)) {
        if (!templateIds.has(templateId)) {
            continue;
        }
        const weight = expectInt(weightRaw, `seasons.${seasonId}.templateWeights.${templateId}`, 1);
        output.set(templateId, weight);
    }
    return output;
}

function parseDisabledTemplates(
    raw: string[] | undefined,
    seasonId: string,
    templateIds: ReadonlySet<string>,
): ReadonlySet<string> {
    if (!Array.isArray(raw)) {
        return new Set<string>();
    }
    const output = new Set<string>();
    for (let i = 0; i < raw.length; i++) {
        const templateId = expectString(raw[i], `seasons.${seasonId}.disabledTemplates[${i}]`);
        if (!templateIds.has(templateId)) continue;
        output.add(templateId);
    }
    return output;
}

function parseSeasonConfigs(
    raw: Record<string, LiveDirectorSeasonJson> | undefined,
    templateIds: ReadonlySet<string>,
): ReadonlyMap<string, LiveDirectorSeasonConfig> {
    if (!raw) {
        throw new Error("[director] seasons must be an object");
    }

    const output = new Map<string, LiveDirectorSeasonConfig>();
    for (const [seasonId, seasonRaw] of Object.entries(raw)) {
        const promptVersion = expectString(
            seasonRaw?.promptVersion,
            `seasons.${seasonId}.promptVersion`,
        );
        const promptFile = expectString(seasonRaw?.promptFile, `seasons.${seasonId}.promptFile`);
        const templateWeights = parseTemplateWeights(
            seasonRaw?.templateWeights,
            seasonId,
            templateIds,
        );
        const disabledTemplates = parseDisabledTemplates(
            seasonRaw?.disabledTemplates,
            seasonId,
            templateIds,
        );

        output.set(seasonId, {
            id: seasonId,
            promptVersion,
            promptFile,
            templateWeights,
            disabledTemplates,
        });
    }

    if (output.size === 0) {
        throw new Error("[director] at least one season definition is required");
    }

    return output;
}

function readPromptFile(baseConfigPath: string, relativePath: string, label: string): string {
    const resolved = path.resolve(path.dirname(baseConfigPath), relativePath);
    const raw = fs.readFileSync(resolved, "utf8");
    const prompt = raw.trim();
    if (prompt.length === 0) {
        throw new Error(`[director] ${label} prompt file is empty: ${resolved}`);
    }
    return prompt;
}

export function loadLiveDirectorConfig(
    configPath: string,
    preferredSeasonId?: string,
): LiveDirectorLoadedConfig {
    const sourcePath = path.resolve(configPath);
    const rawText = fs.readFileSync(sourcePath, "utf8");
    const parsed = JSON.parse(rawText) as LiveDirectorConfigJson;

    const enabled = expectBoolean(parsed.enabled, "enabled");
    const autoDirectorEnabled = expectBoolean(parsed.autoDirectorEnabled, "autoDirectorEnabled");
    const defaultSeasonId = expectString(parsed.seasonId, "seasonId");
    const seasonId =
        preferredSeasonId?.trim() && preferredSeasonId.trim().length > 0
            ? preferredSeasonId.trim()
            : defaultSeasonId;

    const basePromptFile = expectString(parsed.basePromptFile, "basePromptFile");
    const hotfixPromptFile = parsed.hotfixPromptFile?.trim() || undefined;

    const evaluateIntervalTicks = expectInt(
        parsed.evaluateIntervalTicks,
        "evaluateIntervalTicks",
        1,
    );
    const minOnlinePlayersForAutoStart = expectInt(
        parsed.minOnlinePlayersForAutoStart,
        "minOnlinePlayersForAutoStart",
        1,
    );
    const maxConcurrentEvents = expectInt(parsed.maxConcurrentEvents, "maxConcurrentEvents", 1);

    if (!Array.isArray(parsed.templates) || parsed.templates.length === 0) {
        throw new Error("[director] templates array must be non-empty");
    }

    const templates = parsed.templates.map((entry, index) => parseTemplate(entry, index));
    const templateIds = new Set<string>(templates.map((template) => template.id));

    const seasons = parseSeasonConfigs(parsed.seasons, templateIds);
    const selectedSeason = seasons.get(seasonId);
    if (!selectedSeason) {
        const available = Array.from(seasons.keys()).sort();
        throw new Error(
            `[director] unknown season '${seasonId}' (available: ${available.join(", ")})`,
        );
    }

    const basePrompt = readPromptFile(sourcePath, basePromptFile, "base");
    const seasonPrompt = readPromptFile(
        sourcePath,
        selectedSeason.promptFile,
        `season:${seasonId}`,
    );
    const hotfixPrompt = hotfixPromptFile
        ? readPromptFile(sourcePath, hotfixPromptFile, "hotfix")
        : "No active hotfix directives.";

    return {
        sourcePath,
        enabled,
        autoDirectorEnabled,
        seasonId,
        basePromptFile,
        hotfixPromptFile,
        evaluateIntervalTicks,
        minOnlinePlayersForAutoStart,
        maxConcurrentEvents,
        templates,
        seasonConfig: selectedSeason,
        basePrompt,
        seasonPrompt,
        hotfixPrompt,
        availableSeasons: Array.from(seasons.keys()).sort(),
    };
}
