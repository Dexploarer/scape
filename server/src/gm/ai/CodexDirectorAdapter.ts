import {
    type LiveDirectorPromptBundle,
    type LiveDirectorProposal,
    type LiveDirectorTelemetrySnapshot,
    type LiveDirectorTemplateDefinition,
} from "../types";

export interface CodexDirectorInput {
    prompt: LiveDirectorPromptBundle;
    telemetry: LiveDirectorTelemetrySnapshot;
    eligibleTemplates: LiveDirectorTemplateDefinition[];
    templateWeights: ReadonlyMap<string, number>;
    random: () => number;
}

function getTemplateWeight(
    template: LiveDirectorTemplateDefinition,
    templateWeights: ReadonlyMap<string, number>,
): number {
    const seasonWeight = templateWeights.get(template.id);
    if (seasonWeight !== undefined && Number.isFinite(seasonWeight) && seasonWeight > 0) {
        return seasonWeight;
    }
    return 1;
}

function pickWeightedTemplate(
    templates: LiveDirectorTemplateDefinition[],
    templateWeights: ReadonlyMap<string, number>,
    random: () => number,
): LiveDirectorTemplateDefinition | undefined {
    if (templates.length === 0) return undefined;

    let totalWeight = 0;
    const weighted = templates.map((template) => {
        const weight = Math.max(1, getTemplateWeight(template, templateWeights));
        totalWeight += weight;
        return { template, weight };
    });

    if (totalWeight <= 0) return undefined;

    const roll = Math.floor(Math.max(0, random()) * totalWeight);
    let cursor = 0;
    for (const entry of weighted) {
        cursor += entry.weight;
        if (roll < cursor) {
            return entry.template;
        }
    }

    return weighted[weighted.length - 1]?.template;
}

export class CodexDirectorAdapter {
    proposeStart(input: CodexDirectorInput): LiveDirectorProposal | undefined {
        const selected = pickWeightedTemplate(
            input.eligibleTemplates,
            input.templateWeights,
            input.random,
        );
        if (!selected) return undefined;

        const reason =
            `codex proposal selected '${selected.displayName}' ` +
            `(players=${input.telemetry.onlinePlayers}, season=${input.prompt.seasonId})`;

        return {
            templateId: selected.id,
            reason,
            seasonId: input.prompt.seasonId,
            promptVersion: input.prompt.promptVersion,
        };
    }
}
