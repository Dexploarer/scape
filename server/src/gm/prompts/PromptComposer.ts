import { type LiveDirectorPromptBundle, type LiveDirectorTelemetrySnapshot } from "../types";

export interface PromptComposerInput {
    seasonId: string;
    promptVersion: string;
    basePrompt: string;
    seasonPrompt: string;
    hotfixPrompt: string;
    telemetry: LiveDirectorTelemetrySnapshot;
    activeTemplateId?: string;
}

export function composeLiveDirectorPrompt(input: PromptComposerInput): LiveDirectorPromptBundle {
    const worldContext = [
        "World Context:",
        `- Tick: ${input.telemetry.tick}`,
        `- Online players: ${input.telemetry.onlinePlayers}`,
        `- NPC count: ${input.telemetry.npcCount}`,
        `- Active template: ${input.activeTemplateId ?? "none"}`,
    ].join("\n");

    const effectivePrompt = [
        "[Live Director Base Rules]",
        input.basePrompt.trim(),
        "[Season Directives]",
        input.seasonPrompt.trim(),
        "[Hotfix Patch]",
        input.hotfixPrompt.trim(),
        "[Runtime Context]",
        worldContext,
    ]
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .join("\n\n");

    return {
        seasonId: input.seasonId,
        promptVersion: input.promptVersion,
        basePrompt: input.basePrompt,
        seasonPrompt: input.seasonPrompt,
        hotfixPrompt: input.hotfixPrompt,
        effectivePrompt,
    };
}
