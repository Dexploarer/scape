import { logger } from "../../utils/logger";
import { CodexDirectorAdapter } from "../ai/CodexDirectorAdapter";
import { loadLiveDirectorConfig } from "../config/LiveDirectorConfig";
import { composeLiveDirectorPrompt } from "../prompts/PromptComposer";
import { LiveDirectorRuntime } from "../runtime/LiveDirectorRuntime";
import {
    type LiveDirectorAuditEntry,
    type LiveDirectorLoadedConfig,
    type LiveDirectorProposal,
    type LiveDirectorStatusSnapshot,
    type LiveDirectorTelemetrySnapshot,
    type LiveDirectorTemplateDefinition,
} from "../types";

const MAX_AUDIT_ENTRIES = 250;

const directorLogger = logger.withTag("director");

export interface LiveDirectorSystemServices {
    getOnlinePlayerCount: () => number;
    getNpcCount: () => number;
    queueGlobalGameMessage: (text: string) => void;
    random: () => number;
    now: () => number;
}

export class LiveDirectorSystem {
    private readonly configPath: string;
    private readonly services: LiveDirectorSystemServices;
    private readonly codex = new CodexDirectorAdapter();
    private readonly runtime = new LiveDirectorRuntime();

    private config: LiveDirectorLoadedConfig;
    private templateById: Map<string, LiveDirectorTemplateDefinition>;
    private cooldownByTemplateUntilTick = new Map<string, number>();
    private auditEntries: LiveDirectorAuditEntry[] = [];

    private autoDirectorOverride?: boolean;
    private nextEvaluationTick = 0;
    private currentTick = 0;
    private lastProposal?: LiveDirectorProposal;

    constructor(
        configPath: string,
        services: LiveDirectorSystemServices,
        preferredSeasonId?: string,
    ) {
        this.configPath = configPath;
        this.services = services;

        this.config = loadLiveDirectorConfig(this.configPath, preferredSeasonId);
        this.templateById = new Map(
            this.config.templates.map((template) => [template.id, template]),
        );
        this.nextEvaluationTick = this.config.evaluateIntervalTicks;
        if (this.config.maxConcurrentEvents !== 1) {
            directorLogger.warn(
                `[director] maxConcurrentEvents=${this.config.maxConcurrentEvents} configured but runtime currently supports 1 active event`,
            );
        }

        directorLogger.info(
            `[director] loaded config season=${this.config.seasonId} templates=${
                this.config.templates.length
            } auto=${this.isAutoDirectorEnabled()}`,
        );
    }

    processTick(tick: number): void {
        this.currentTick = tick;
        if (!this.config.enabled) return;

        const transitions = this.runtime.processTick(this.currentTick, this.templateById);
        for (const transition of transitions) {
            this.handleRuntimeTransition(
                transition.event.templateId,
                transition.kind,
                transition.nextPhase,
            );
        }

        if (!this.isAutoDirectorEnabled()) {
            return;
        }
        if (this.runtime.hasActiveEvent()) {
            return;
        }
        if (this.currentTick < this.nextEvaluationTick) {
            return;
        }

        this.nextEvaluationTick = this.currentTick + this.config.evaluateIntervalTicks;
        this.runAutoDirectorEvaluation();
    }

    startTemplate(
        templateId: string,
        actor: string,
        reason: string,
    ): { ok: boolean; message: string } {
        const template = this.templateById.get(templateId);
        if (!template) {
            const message = `unknown template '${templateId}'`;
            this.appendAudit({
                actor,
                action: "start",
                templateId,
                result: "rejected",
                detail: message,
            });
            return { ok: false, message };
        }

        if (this.config.seasonConfig.disabledTemplates.has(template.id)) {
            const message = `template '${templateId}' is disabled for season '${this.config.seasonId}'`;
            this.appendAudit({
                actor,
                action: "start",
                templateId,
                result: "rejected",
                detail: message,
            });
            return { ok: false, message };
        }

        if (this.runtime.hasActiveEvent()) {
            const active = this.runtime.getActiveEvent();
            const message = `active event already running (${active?.templateId ?? "unknown"})`;
            this.appendAudit({
                actor,
                action: "start",
                templateId,
                result: "rejected",
                detail: message,
            });
            return { ok: false, message };
        }

        const cooldownUntilTick = this.cooldownByTemplateUntilTick.get(template.id) ?? 0;
        if (cooldownUntilTick > this.currentTick) {
            const message = `template '${template.id}' cooldown active (${
                cooldownUntilTick - this.currentTick
            } ticks left)`;
            this.appendAudit({
                actor,
                action: "start",
                templateId,
                result: "rejected",
                detail: message,
            });
            return { ok: false, message };
        }

        const onlinePlayers = this.services.getOnlinePlayerCount();
        const minPlayers = template.minOnlinePlayers ?? 1;
        if (onlinePlayers < minPlayers) {
            const message = `template '${template.id}' requires ${minPlayers} players (online=${onlinePlayers})`;
            this.appendAudit({
                actor,
                action: "start",
                templateId,
                result: "rejected",
                detail: message,
            });
            return { ok: false, message };
        }

        const started = this.runtime.startEvent({
            template,
            tick: this.currentTick,
            actor,
            reason,
        });
        if (!started) {
            const message = "failed to start event";
            this.appendAudit({
                actor,
                action: "start",
                templateId,
                result: "error",
                detail: message,
            });
            return { ok: false, message };
        }

        this.queueDirectorMessage(template.announceText);
        this.appendAudit({
            actor,
            action: "start",
            templateId,
            result: "ok",
            detail: reason,
        });
        directorLogger.info(
            `[director] started template=${template.id} actor=${actor} tick=${this.currentTick} reason=${reason}`,
        );

        return { ok: true, message: `started '${template.id}'` };
    }

    stopActive(actor: string, reason: string): { ok: boolean; message: string } {
        const stopped = this.runtime.stopEvent();
        if (!stopped) {
            return { ok: false, message: "no active event to stop" };
        }

        const template = this.templateById.get(stopped.templateId);
        if (template) {
            const cooldownUntilTick = this.currentTick + template.cooldownTicks;
            this.cooldownByTemplateUntilTick.set(template.id, cooldownUntilTick);
        }

        this.queueDirectorMessage(`Event '${stopped.templateId}' was stopped by ${actor}.`);
        this.appendAudit({
            actor,
            action: "stop",
            templateId: stopped.templateId,
            result: "ok",
            detail: reason,
        });
        directorLogger.warn(
            `[director] stopped template=${stopped.templateId} actor=${actor} tick=${this.currentTick} reason=${reason}`,
        );

        return { ok: true, message: `stopped '${stopped.templateId}'` };
    }

    reload(actor: string): { ok: boolean; message: string } {
        try {
            const loaded = loadLiveDirectorConfig(this.configPath, this.config.seasonId);
            this.applyLoadedConfig(loaded);
            this.appendAudit({
                actor,
                action: "reload",
                result: "ok",
                detail: `season=${this.config.seasonId}`,
            });
            return { ok: true, message: `reloaded config (season=${this.config.seasonId})` };
        } catch (err) {
            this.appendAudit({
                actor,
                action: "reload",
                result: "error",
                detail: String((err as Error)?.message ?? err),
            });
            return {
                ok: false,
                message: `reload failed: ${String((err as Error)?.message ?? err)}`,
            };
        }
    }

    setSeason(seasonId: string, actor: string): { ok: boolean; message: string } {
        try {
            const loaded = loadLiveDirectorConfig(this.configPath, seasonId);
            this.applyLoadedConfig(loaded);
            this.appendAudit({
                actor,
                action: "set_season",
                result: "ok",
                detail: `season=${seasonId}`,
            });
            this.queueDirectorMessage(`Live Director season switched to '${seasonId}'.`);
            return { ok: true, message: `season set to '${seasonId}'` };
        } catch (err) {
            const message = String((err as Error)?.message ?? err);
            this.appendAudit({
                actor,
                action: "set_season",
                result: "error",
                detail: message,
            });
            return { ok: false, message: `season change failed: ${message}` };
        }
    }

    setAutoDirectorEnabled(enabled: boolean, actor: string): { ok: boolean; message: string } {
        this.autoDirectorOverride = !!enabled;
        this.appendAudit({
            actor,
            action: "set_auto",
            result: "ok",
            detail: `enabled=${enabled}`,
        });
        return { ok: true, message: `auto director ${enabled ? "enabled" : "disabled"}` };
    }

    getStatusSnapshot(): LiveDirectorStatusSnapshot {
        return {
            enabled: this.config.enabled,
            autoDirectorEnabled: this.isAutoDirectorEnabled(),
            seasonId: this.config.seasonId,
            promptVersion: this.config.seasonConfig.promptVersion,
            nextEvaluationTick: this.nextEvaluationTick,
            templateCount: this.config.templates.length,
            activeEvent: this.runtime.getActiveEvent(),
            lastProposal: this.lastProposal,
        };
    }

    getRecentAudit(limit = 20): LiveDirectorAuditEntry[] {
        if (limit <= 0) return [];
        return this.auditEntries.slice(-Math.min(limit, this.auditEntries.length));
    }

    private applyLoadedConfig(loaded: LiveDirectorLoadedConfig): void {
        this.config = loaded;
        this.templateById = new Map(
            this.config.templates.map((template) => [template.id, template]),
        );

        for (const key of Array.from(this.cooldownByTemplateUntilTick.keys())) {
            if (!this.templateById.has(key)) {
                this.cooldownByTemplateUntilTick.delete(key);
            }
        }

        const active = this.runtime.getActiveEvent();
        if (active && !this.templateById.has(active.templateId)) {
            this.runtime.stopEvent();
            this.queueDirectorMessage(
                `Active event '${active.templateId}' was stopped because the template is not available in the new season config.`,
            );
        }

        this.nextEvaluationTick = this.currentTick + this.config.evaluateIntervalTicks;
        directorLogger.info(
            `[director] config applied season=${this.config.seasonId} templates=${
                this.config.templates.length
            } auto=${this.isAutoDirectorEnabled()}`,
        );
    }

    private isAutoDirectorEnabled(): boolean {
        if (this.autoDirectorOverride !== undefined) {
            return this.autoDirectorOverride;
        }
        return this.config.autoDirectorEnabled;
    }

    private getTelemetrySnapshot(): LiveDirectorTelemetrySnapshot {
        return {
            tick: this.currentTick,
            onlinePlayers: this.services.getOnlinePlayerCount(),
            npcCount: this.services.getNpcCount(),
        };
    }

    private getEligibleTemplates(
        tick: number,
        onlinePlayers: number,
    ): LiveDirectorTemplateDefinition[] {
        const results: LiveDirectorTemplateDefinition[] = [];
        for (const template of this.config.templates) {
            if (this.config.seasonConfig.disabledTemplates.has(template.id)) {
                continue;
            }
            const minPlayers = template.minOnlinePlayers ?? 1;
            if (onlinePlayers < minPlayers) {
                continue;
            }
            const cooldownUntil = this.cooldownByTemplateUntilTick.get(template.id) ?? 0;
            if (cooldownUntil > tick) {
                continue;
            }
            results.push(template);
        }
        return results;
    }

    private runAutoDirectorEvaluation(): void {
        const telemetry = this.getTelemetrySnapshot();
        if (telemetry.onlinePlayers < this.config.minOnlinePlayersForAutoStart) {
            return;
        }

        const eligibleTemplates = this.getEligibleTemplates(
            this.currentTick,
            telemetry.onlinePlayers,
        );
        if (eligibleTemplates.length === 0) {
            return;
        }

        const prompt = composeLiveDirectorPrompt({
            seasonId: this.config.seasonId,
            promptVersion: this.config.seasonConfig.promptVersion,
            basePrompt: this.config.basePrompt,
            seasonPrompt: this.config.seasonPrompt,
            hotfixPrompt: this.config.hotfixPrompt,
            telemetry,
            activeTemplateId: this.runtime.getActiveEvent()?.templateId,
        });

        const proposal = this.codex.proposeStart({
            prompt,
            telemetry,
            eligibleTemplates,
            templateWeights: this.config.seasonConfig.templateWeights,
            random: this.services.random,
        });

        if (!proposal) {
            return;
        }

        this.lastProposal = proposal;
        const startResult = this.startTemplate(proposal.templateId, "codex", proposal.reason);
        if (!startResult.ok) {
            this.appendAudit({
                actor: "codex",
                action: "propose_start",
                templateId: proposal.templateId,
                result: "rejected",
                detail: startResult.message,
            });
        }
    }

    private handleRuntimeTransition(
        templateId: string,
        kind: "phase_changed" | "completed",
        nextPhase?: string,
    ): void {
        const template = this.templateById.get(templateId);
        if (!template) return;

        if (kind === "phase_changed") {
            if (nextPhase === "active" && template.activeText) {
                this.queueDirectorMessage(template.activeText);
            }
            return;
        }

        if (template.completeText) {
            this.queueDirectorMessage(template.completeText);
        }

        const cooldownUntilTick = this.currentTick + template.cooldownTicks;
        this.cooldownByTemplateUntilTick.set(template.id, cooldownUntilTick);
        this.appendAudit({
            actor: "system",
            action: "complete",
            templateId: template.id,
            result: "ok",
            detail: `cooldownUntilTick=${cooldownUntilTick}`,
        });
    }

    private queueDirectorMessage(text: string): void {
        const trimmed = String(text ?? "").trim();
        if (trimmed.length === 0) return;
        this.services.queueGlobalGameMessage(`[Director] ${trimmed}`);
    }

    private appendAudit(entry: {
        actor: string;
        action: string;
        seasonId?: string;
        promptVersion?: string;
        templateId?: string;
        result: "ok" | "rejected" | "error";
        detail?: string;
    }): void {
        this.auditEntries.push({
            timestamp: this.services.now(),
            tick: this.currentTick,
            actor: entry.actor,
            action: entry.action,
            seasonId: entry.seasonId ?? this.config.seasonId,
            promptVersion: entry.promptVersion ?? this.config.seasonConfig.promptVersion,
            templateId: entry.templateId,
            result: entry.result,
            detail: entry.detail,
        });

        if (this.auditEntries.length > MAX_AUDIT_ENTRIES) {
            this.auditEntries.splice(0, this.auditEntries.length - MAX_AUDIT_ENTRIES);
        }
    }
}
