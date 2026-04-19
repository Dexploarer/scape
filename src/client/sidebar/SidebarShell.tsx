import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
    type BotSdkJournalSnapshot,
    isServerConnected,
    requestBotSdkScriptProposalSnapshot,
    sendBotSdkScriptControl,
    sendBotSdkScriptProposalDecision,
    sendChat,
    subscribeBotSdkScriptProposalSnapshot,
    subscribeChatMessages,
    subscribeNpcInfo,
    subscribePlayerSync,
} from "../../network/ServerConnection";
import type { OsrsClient } from "../OsrsClient";
import type { GroundItemsPluginConfig } from "../plugins/grounditems/types";
import type { InteractHighlightPluginConfig } from "../plugins/interacthighlight/types";
import type { NotesPluginJournalTabId, NotesPluginScriptProposal } from "../plugins/notes/types";
import type { TileMarkersPluginConfig } from "../plugins/tilemarkers/types";
import "./SidebarShell.css";
import type { SidebarStore } from "./SidebarStore";
import {
    BOT_SDK_DRAFT_STORAGE_KEY,
    BOT_SDK_PRESET_DIRECTIVES,
    type BotSdkFeedback,
    appendBotSdkDirectiveContext,
    buildBotSdkSteerCommand,
    extractBotSdkFeedbackFromChat,
    normalizeBotSdkDirective,
} from "./botSdkPanelUtils";
import type { ClientSidebarEntryData, SidebarPanelId } from "./entries";
import {
    JOURNAL_SCRIPT_TEMPLATES,
    JOURNAL_RUNTIME_SCRIPT_TEMPLATES,
    JOURNAL_SECTIONS,
    appendJournalTemplate,
    buildJournalFinancialSummary,
    buildJournalPeopleSummary,
    buildJournalScriptProposalFromMessage,
    buildJournalScriptTargets,
    buildJournalDirectiveContext,
    findJournalSection,
    parseJournalScriptSpec,
    type JournalSummaryGroup,
} from "./journalPanelUtils";
import type { SidebarRailIconRenderer } from "./pluginTypes";
import type { AgentScriptSpec } from "../../shared/agent/AgentScript";

function toColorInput(color: number): string {
    const hex = (Math.max(0, color | 0) & 0xffffff).toString(16).padStart(6, "0");
    return `#${hex}`;
}

function parseColorInput(raw: string, fallback: number): number {
    const match = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
    if (!match) return fallback;
    return parseInt(match[1], 16) & 0xffffff;
}

function parseInteger(raw: string, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.floor(parsed));
}

function SidebarRailIcon({
    icon,
    label,
}: {
    icon?: SidebarRailIconRenderer;
    label: string;
}): JSX.Element {
    if (!icon) {
        return <span className="rl-sidebar-icon-fallback">{label.slice(0, 1).toUpperCase()}</span>;
    }
    const Icon = icon;
    return <Icon label={label} />;
}

function SidebarToggleGlyph({ open }: { open: boolean }): JSX.Element {
    return (
        <svg className="rl-sidebar-toggle-chevron" viewBox="0 0 12 20" aria-hidden="true">
            <path d={open ? "M3.6 3.1L8.1 10l-4.5 6.9" : "M8.4 3.1L3.9 10l4.5 6.9"} />
        </svg>
    );
}

function useJournalLiveVersion(osrsClient: OsrsClient): number {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const bump = () => {
            setVersion((current) => current + 1);
        };

        const unsubscribeInventory = osrsClient.inventory.subscribe(() => {
            bump();
        });
        const unsubscribeBank = osrsClient.bankInventory.subscribe(() => {
            bump();
        });
        const unsubscribePlayers = subscribePlayerSync(() => {
            bump();
        });
        const unsubscribeNpcs = subscribeNpcInfo(() => {
            bump();
        });

        return () => {
            unsubscribeInventory();
            unsubscribeBank();
            unsubscribePlayers();
            unsubscribeNpcs();
        };
    }, [osrsClient]);

    return version;
}

function SidebarJournalPanel({ osrsClient }: { osrsClient: OsrsClient }): JSX.Element {
    const plugin = osrsClient.notesPlugin;
    const [scriptFeedback, setScriptFeedback] = useState<BotSdkFeedback | null>(null);
    const [selectedScriptTarget, setSelectedScriptTarget] = useState<string>("all");
    const [remoteScriptJournal, setRemoteScriptJournal] = useState<BotSdkJournalSnapshot>({
        targetPlayerId: undefined as number | undefined,
        proposals: [] as Array<{
            proposalId: string;
            playerId: number;
            agentId: string;
            displayName: string;
            summary?: string;
            script: AgentScriptSpec;
            proposedAt: number;
        }>,
        activities: [] as Array<{
            id: string;
            kind: "proposal" | "decision" | "control";
            text: string;
            timestamp: number;
            playerId?: number;
            proposalId?: string;
        }>,
    });
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    useJournalLiveVersion(osrsClient);
    const activeSection = useMemo(
        () => findJournalSection(state.config.activeTab),
        [state.config.activeTab],
    );
    const totalCharacters = useMemo(
        () =>
            JOURNAL_SECTIONS.reduce(
                (count, section) => count + state.config.journal[section.entryKey].trim().length,
                0,
            ),
        [state.config.journal],
    );
    const populatedSections = useMemo(
        () =>
            JOURNAL_SECTIONS.filter(
                (section) => state.config.journal[section.entryKey].trim().length > 0,
            ).length,
        [state.config.journal],
    );
    const peopleSummary = buildJournalPeopleSummary(osrsClient);
    const financialSummary = buildJournalFinancialSummary(osrsClient);
    const scriptTargets = buildJournalScriptTargets(osrsClient);
    const selectedScriptTargetId =
        selectedScriptTarget === "all" ? undefined : Number(selectedScriptTarget);
    const selectedScriptTargetEntry = useMemo(
        () =>
            selectedScriptTargetId === undefined
                ? undefined
                : scriptTargets.find((target) => target.playerId === selectedScriptTargetId),
        [scriptTargets, selectedScriptTargetId],
    );

    const onSelectTab = useCallback(
        (tabId: NotesPluginJournalTabId) => {
            plugin.setActiveTab(tabId);
        },
        [plugin],
    );
    const onChange = useCallback(
        (value: string) => {
            plugin.setJournalEntry(activeSection.id, value);
        },
        [activeSection.id, plugin],
    );
    const onInsertTemplate = useCallback(
        (template: string) => {
            const currentEntry = state.config.journal[activeSection.entryKey];
            plugin.setJournalEntry(activeSection.id, appendJournalTemplate(currentEntry, template));
        },
        [activeSection.entryKey, activeSection.id, plugin, state.config.journal],
    );
    const currentScriptEntry = state.config.journal.scripts;
    const scriptProposals = state.config.scriptProposals;
    const scriptActivity = state.config.scriptActivity;
    const remoteScriptProposals = remoteScriptJournal.proposals;
    const combinedScriptActivity = useMemo(
        () =>
            [...remoteScriptJournal.activities, ...scriptActivity]
                .sort((left, right) => right.timestamp - left.timestamp)
                .slice(0, 8),
        [remoteScriptJournal.activities, scriptActivity],
    );

    useEffect(() => {
        if (selectedScriptTarget === "all") {
            return;
        }
        if (!scriptTargets.some((target) => String(target.playerId) === selectedScriptTarget)) {
            setSelectedScriptTarget("all");
        }
    }, [scriptTargets, selectedScriptTarget]);

    useEffect(() => {
        return subscribeChatMessages((message) => {
            const now = Date.now();
            const feedback = extractBotSdkFeedbackFromChat(message);
            if (feedback) {
                setScriptFeedback(feedback);
                plugin.appendScriptActivity({
                    id: `${now}:${feedback.kind}:${feedback.text}`,
                    kind: feedback.kind,
                    text: feedback.text,
                    timestamp: now,
                });
            }

            const proposal = buildJournalScriptProposalFromMessage({
                text: message.text,
                from: message.from,
                playerId: message.playerId,
                timestamp: now,
            });
            if (proposal) {
                const result = plugin.upsertScriptProposal(proposal);
                if (result !== "unchanged") {
                    plugin.appendScriptActivity({
                        id: `${proposal.id}:${proposal.capturedAt}`,
                        kind: "proposal",
                        text: `Captured script proposal ${proposal.scriptId}${proposal.sourceName ? ` from ${proposal.sourceName}` : ""}.`,
                        timestamp: proposal.capturedAt,
                    });
                }
            }
        });
    }, [plugin]);

    useEffect(
        () =>
            subscribeBotSdkScriptProposalSnapshot((snapshot) => {
                setRemoteScriptJournal(snapshot);
            }),
        [],
    );

    useEffect(() => {
        if (activeSection.id !== "scripts" || !isServerConnected()) {
            return;
        }
        requestBotSdkScriptProposalSnapshot(selectedScriptTargetId);
    }, [activeSection.id, selectedScriptTargetId]);

    const installScriptSpec = useCallback(
        (script: AgentScriptSpec, scriptId: string) => {
            sendBotSdkScriptControl({
                operation: "install",
                script,
                targetPlayerId: selectedScriptTargetId,
            });
            setScriptFeedback({
                kind: "info",
                text:
                    selectedScriptTargetEntry
                        ? `Installing script ${scriptId} on ${selectedScriptTargetEntry.name}...`
                        : `Installing script ${scriptId} on all connected agents...`,
            });
        },
        [selectedScriptTargetEntry, selectedScriptTargetId],
    );

    const onInstallScript = useCallback(() => {
        if (!isServerConnected()) {
            setScriptFeedback({
                kind: "error",
                text: "Game server is disconnected.",
            });
            return;
        }
        const parsed = parseJournalScriptSpec(currentScriptEntry);
        if (!parsed.ok) {
            setScriptFeedback({
                kind: "error",
                text: parsed.error,
            });
            return;
        }
        installScriptSpec(parsed.script, parsed.script.scriptId);
    }, [currentScriptEntry, installScriptSpec]);

    const onClearScript = useCallback(() => {
        if (!isServerConnected()) {
            setScriptFeedback({
                kind: "error",
                text: "Game server is disconnected.",
            });
            return;
        }
        sendBotSdkScriptControl({
            operation: "clear",
            reason: "operator_journal_clear",
            targetPlayerId: selectedScriptTargetId,
        });
        setScriptFeedback({
            kind: "info",
            text:
                selectedScriptTargetEntry
                    ? `Clearing active scripts on ${selectedScriptTargetEntry.name}...`
                    : "Clearing active scripts on all connected agents...",
        });
    }, [selectedScriptTargetEntry, selectedScriptTargetId]);

    const onLoadProposal = useCallback(
        (proposal: NotesPluginScriptProposal) => {
            plugin.setJournalEntry("scripts", proposal.scriptText);
            setScriptFeedback({
                kind: "info",
                text: `Loaded proposal ${proposal.scriptId} into the Scripts editor.`,
            });
        },
        [plugin],
    );

    const onInstallProposal = useCallback(
        (proposal: NotesPluginScriptProposal) => {
            if (!isServerConnected()) {
                setScriptFeedback({
                    kind: "error",
                    text: "Game server is disconnected.",
                });
                return;
            }
            const parsed = parseJournalScriptSpec(proposal.scriptText);
            if (!parsed.ok) {
                setScriptFeedback({
                    kind: "error",
                    text: parsed.error,
                });
                return;
            }
            installScriptSpec(parsed.script, parsed.script.scriptId);
        },
        [installScriptSpec],
    );

    const onDismissProposal = useCallback(
        (proposalId: string) => {
            plugin.dismissScriptProposal(proposalId);
        },
        [plugin],
    );

    const onLoadRemoteProposal = useCallback(
        (proposal: (typeof remoteScriptProposals)[number]) => {
            plugin.setJournalEntry("scripts", JSON.stringify(proposal.script, null, 2));
            setScriptFeedback({
                kind: "info",
                text: `Loaded live proposal ${proposal.proposalId} from ${proposal.displayName}.`,
            });
        },
        [plugin],
    );

    const onApproveRemoteProposal = useCallback(
        (proposal: (typeof remoteScriptProposals)[number]) => {
            if (!isServerConnected()) {
                setScriptFeedback({
                    kind: "error",
                    text: "Game server is disconnected.",
                });
                return;
            }
            sendBotSdkScriptProposalDecision({
                proposalId: proposal.proposalId,
                decision: "approve_install",
            });
            requestBotSdkScriptProposalSnapshot(selectedScriptTargetId);
            setScriptFeedback({
                kind: "info",
                text: `Approving ${proposal.displayName}'s proposal ${proposal.proposalId}...`,
            });
        },
        [selectedScriptTargetId],
    );

    const onRejectRemoteProposal = useCallback(
        (proposal: (typeof remoteScriptProposals)[number]) => {
            if (!isServerConnected()) {
                setScriptFeedback({
                    kind: "error",
                    text: "Game server is disconnected.",
                });
                return;
            }
            sendBotSdkScriptProposalDecision({
                proposalId: proposal.proposalId,
                decision: "reject",
                reason: "operator_journal_reject",
            });
            requestBotSdkScriptProposalSnapshot(selectedScriptTargetId);
            setScriptFeedback({
                kind: "info",
                text: `Rejecting ${proposal.displayName}'s proposal ${proposal.proposalId}...`,
            });
        },
        [selectedScriptTargetId],
    );

    const onInterruptScript = useCallback(() => {
        if (!isServerConnected()) {
            setScriptFeedback({
                kind: "error",
                text: "Game server is disconnected.",
            });
            return;
        }
        sendBotSdkScriptControl({
            operation: "interrupt",
            interrupt: "INTERRUPT_STOP",
            reason: "operator_journal_interrupt",
            targetPlayerId: selectedScriptTargetId,
        });
        setScriptFeedback({
            kind: "info",
            text:
                selectedScriptTargetEntry
                    ? `Interrupting active scripts on ${selectedScriptTargetEntry.name}...`
                    : "Interrupting active scripts on all connected agents...",
        });
    }, [selectedScriptTargetEntry, selectedScriptTargetId]);

    return (
        <div className="rl-sidebar-panel-content rl-sidebar-scrollable">
            <div className="rl-sidebar-panel-title">Agent Journal</div>
            <p className="rl-sidebar-panel-copy">
                Keep one durable operating log for the current agent. Scripts, people, memories,
                and money all live here instead of in a single scratchpad.
            </p>
            <div className="rl-sidebar-journal-meta">
                <span>{populatedSections} / {JOURNAL_SECTIONS.length} sections active</span>
                <span>{totalCharacters} chars logged</span>
            </div>
            <div className="rl-sidebar-journal-tabs" role="tablist" aria-label="Agent journal sections">
                {JOURNAL_SECTIONS.map((section) => (
                    <button
                        key={section.id}
                        type="button"
                        role="tab"
                        aria-selected={activeSection.id === section.id}
                        className={`rl-sidebar-journal-tab ${
                            activeSection.id === section.id ? "active" : ""
                        }`}
                        onClick={() => onSelectTab(section.id)}
                    >
                        {section.label}
                    </button>
                ))}
            </div>
            <div className="rl-sidebar-journal-section">
                <div className="rl-sidebar-journal-section-title">{activeSection.label}</div>
                <p className="rl-sidebar-panel-copy">{activeSection.description}</p>
                {activeSection.id === "scripts" ? (
                    <>
                        <div className="rl-sidebar-field">
                            <span>Planning templates</span>
                            <div className="rl-sidebar-action-grid">
                                {JOURNAL_SCRIPT_TEMPLATES.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        className="rl-sidebar-chip"
                                        onClick={() => onInsertTemplate(template.content)}
                                    >
                                        {template.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="rl-sidebar-field">
                            <span>Installable JSON templates</span>
                            <div className="rl-sidebar-action-grid">
                                {JOURNAL_RUNTIME_SCRIPT_TEMPLATES.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        className="rl-sidebar-chip"
                                        onClick={() => plugin.setJournalEntry("scripts", template.content)}
                                    >
                                        {template.label}
                                    </button>
                                ))}
                            </div>
                            <div className="rl-sidebar-panel-copy">
                                Installable specs accept raw JSON or a fenced
                                {" "}
                                <span className="rl-sidebar-inline-code">```json</span>
                                {" "}
                                block.
                            </div>
                        </div>
                        <label className="rl-sidebar-field">
                            <span>Target</span>
                            <select
                                value={selectedScriptTarget}
                                onChange={(event) => setSelectedScriptTarget(event.target.value)}
                            >
                                <option value="all">All connected agents</option>
                                {scriptTargets.map((target) => (
                                    <option key={target.playerId} value={String(target.playerId)}>
                                        {`${target.name} (lvl ${target.combatLevel}, ${target.distance} tiles)`}
                                    </option>
                                ))}
                            </select>
                            <div className="rl-sidebar-panel-copy">
                                Target a visible in-world player branch or leave this on broadcast to steer every connected agent.
                            </div>
                        </label>
                        {scriptProposals.length > 0 ? (
                            <div className="rl-sidebar-field">
                                <span>Proposal Inbox</span>
                                <div className="rl-sidebar-journal-summaries">
                                    {scriptProposals.map((proposal) => (
                                        <div key={proposal.id} className="rl-sidebar-journal-summary-card">
                                            <div className="rl-sidebar-journal-summary-title">
                                                {proposal.name ?? proposal.scriptId}
                                            </div>
                                            <ul className="rl-sidebar-journal-summary-list">
                                                <li>
                                                    {proposal.goal ?? "No explicit goal attached."}
                                                </li>
                                                <li>
                                                    {proposal.sourceName
                                                        ? `From ${proposal.sourceName}`
                                                        : "Source unknown"}
                                                </li>
                                                <li>
                                                    {`Captured ${formatJournalTimestamp(proposal.capturedAt)}`}
                                                </li>
                                            </ul>
                                            <div className="rl-sidebar-button-row">
                                                <button
                                                    type="button"
                                                    className="rl-sidebar-action-button"
                                                    onClick={() => onLoadProposal(proposal)}
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rl-sidebar-action-button primary"
                                                    onClick={() => onInstallProposal(proposal)}
                                                >
                                                    Install
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rl-sidebar-action-button"
                                                    onClick={() => onDismissProposal(proposal.id)}
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {remoteScriptProposals.length > 0 ? (
                            <div className="rl-sidebar-field">
                                <span>Live Agent Proposals</span>
                                <div className="rl-sidebar-journal-summaries">
                                    {remoteScriptProposals.map((proposal) => (
                                        <div
                                            key={proposal.proposalId}
                                            className="rl-sidebar-journal-summary-card"
                                        >
                                            <div className="rl-sidebar-journal-summary-title">
                                                {proposal.summary ?? proposal.proposalId}
                                            </div>
                                            <ul className="rl-sidebar-journal-summary-list">
                                                <li>{`From ${proposal.displayName}`}</li>
                                                <li>{proposal.agentId}</li>
                                                <li>{`Captured ${formatJournalTimestamp(proposal.proposedAt)}`}</li>
                                            </ul>
                                            <div className="rl-sidebar-button-row">
                                                <button
                                                    type="button"
                                                    className="rl-sidebar-action-button"
                                                    onClick={() => onLoadRemoteProposal(proposal)}
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rl-sidebar-action-button primary"
                                                    onClick={() => onApproveRemoteProposal(proposal)}
                                                >
                                                    Approve + Install
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rl-sidebar-action-button"
                                                    onClick={() => onRejectRemoteProposal(proposal)}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : null}
                {activeSection.id === "people" ? (
                    <SidebarJournalSummary groups={peopleSummary} />
                ) : null}
                {activeSection.id === "financial_status" ? (
                    <SidebarJournalSummary groups={financialSummary} />
                ) : null}
                <textarea
                    className="rl-sidebar-notes-input rl-sidebar-journal-textarea"
                    value={state.config.journal[activeSection.entryKey]}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={activeSection.placeholder}
                />
                {activeSection.id === "scripts" ? (
                    <>
                        <div className="rl-sidebar-button-row">
                            <button
                                type="button"
                                className="rl-sidebar-action-button primary"
                                onClick={onInstallScript}
                            >
                                Install Script
                            </button>
                            <button
                                type="button"
                                className="rl-sidebar-action-button"
                                onClick={onInterruptScript}
                            >
                                Interrupt Stop
                            </button>
                            <button
                                type="button"
                                className="rl-sidebar-action-button"
                                onClick={onClearScript}
                            >
                                Clear Script
                            </button>
                        </div>
                        {scriptFeedback ? (
                            <div className={`rl-sidebar-status ${scriptFeedback.kind}`}>{scriptFeedback.text}</div>
                        ) : (
                            <div className="rl-sidebar-status info">
                                Script control feedback appears here after the server responds.
                            </div>
                        )}
                        {combinedScriptActivity.length > 0 ? (
                            <div className="rl-sidebar-field">
                                <span>Recent Activity</span>
                                <div className="rl-sidebar-journal-summaries">
                                    <div className="rl-sidebar-journal-summary-card">
                                        <ul className="rl-sidebar-journal-summary-list">
                                            {combinedScriptActivity.map((entry) => (
                                                <li key={entry.id}>
                                                    {`${formatJournalTimestamp(entry.timestamp)} · ${entry.text}`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
            <div className="rl-sidebar-panel-copy">
                Local journal text stays in this browser profile. Live script proposals and decisions sync through the connected world runtime when available.
            </div>
        </div>
    );
}

function SidebarJournalSummary({ groups }: { groups: ReadonlyArray<JournalSummaryGroup> }): JSX.Element {
    return (
        <div className="rl-sidebar-journal-summaries">
            {groups.map((group) => (
                <div key={group.title} className="rl-sidebar-journal-summary-card">
                    <div className="rl-sidebar-journal-summary-title">{group.title}</div>
                    <ul className="rl-sidebar-journal-summary-list">
                        {group.lines.map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function formatJournalTimestamp(timestamp: number): string {
    if (!Number.isFinite(timestamp)) {
        return "just now";
    }
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function loadBotSdkDraft(): string {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
        return "";
    }
    try {
        const raw = window.localStorage.getItem(BOT_SDK_DRAFT_STORAGE_KEY);
        return normalizeBotSdkDirective(raw ?? "");
    } catch {
        return "";
    }
}

function BotSdkPanel({ osrsClient }: { osrsClient: OsrsClient }): JSX.Element {
    const [draft, setDraft] = useState<string>(() => loadBotSdkDraft());
    const [lastFeedback, setLastFeedback] = useState<BotSdkFeedback | null>(null);
    const [lastDirective, setLastDirective] = useState<string>("");
    const plugin = osrsClient.notesPlugin;
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const journalState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    useJournalLiveVersion(osrsClient);
    const peopleSummary = buildJournalPeopleSummary(osrsClient);
    const financialSummary = buildJournalFinancialSummary(osrsClient);
    const activeJournalContext = useMemo(
        () =>
            buildJournalDirectiveContext({
                config: journalState.config,
                activeTabOnly: true,
                peopleSummary,
                financialSummary,
            }),
        [financialSummary, journalState.config, peopleSummary],
    );
    const fullJournalContext = useMemo(
        () =>
            buildJournalDirectiveContext({
                config: journalState.config,
                peopleSummary,
                financialSummary,
            }),
        [financialSummary, journalState.config, peopleSummary],
    );

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
            return;
        }
        try {
            const normalized = normalizeBotSdkDirective(draft);
            if (normalized) {
                window.localStorage.setItem(BOT_SDK_DRAFT_STORAGE_KEY, normalized);
            } else {
                window.localStorage.removeItem(BOT_SDK_DRAFT_STORAGE_KEY);
            }
        } catch {}
    }, [draft]);

    useEffect(() => {
        return subscribeChatMessages((message) => {
            const feedback = extractBotSdkFeedbackFromChat(message);
            if (feedback) {
                setLastFeedback(feedback);
            }
        });
    }, []);

    const onSend = useCallback(() => {
        const command = buildBotSdkSteerCommand(draft);
        if (!command) {
            setLastFeedback({
                kind: "error",
                text: "Directive cannot be empty.",
            });
            return;
        }
        if (!isServerConnected()) {
            setLastFeedback({
                kind: "error",
                text: "Game server is disconnected.",
            });
            return;
        }

        const directive = normalizeBotSdkDirective(draft);
        sendChat(command);
        setLastDirective(directive);
        setLastFeedback({
            kind: "info",
            text: "Dispatching steer directive...",
        });
    }, [draft]);
    const onAppendJournalContext = useCallback(
        (context: string) => {
            setDraft((current) => appendBotSdkDirectiveContext(current, context));
        },
        [],
    );

    const onKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
            if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
                return;
            }
            event.preventDefault();
            onSend();
        },
        [onSend],
    );

    return (
        <div className="rl-sidebar-panel-content rl-sidebar-scrollable">
            <div className="rl-sidebar-panel-title">Bot SDK</div>
            <p className="rl-sidebar-panel-copy">
                Steer all connected BotSDK agents from the main client UI. This panel routes through
                the existing <code>::steer</code> server command path.
            </p>

            <label className="rl-sidebar-field">
                <span>Directive</span>
                <textarea
                    className="rl-sidebar-textarea rl-sidebar-botsdk-textarea"
                    rows={5}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Example: Follow my player and bank any ore you mine."
                />
            </label>

            <div className="rl-sidebar-button-row">
                <button type="button" className="rl-sidebar-action-button primary" onClick={onSend}>
                    Send Directive
                </button>
                <button
                    type="button"
                    className="rl-sidebar-action-button"
                    onClick={() => setDraft("")}
                >
                    Clear
                </button>
            </div>

            <div className="rl-sidebar-field">
                <span>Quick directives</span>
                <div className="rl-sidebar-action-grid">
                    {BOT_SDK_PRESET_DIRECTIVES.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            className="rl-sidebar-chip"
                            onClick={() => setDraft(preset.directive)}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="rl-sidebar-field">
                <span>Journal assist</span>
                <div className="rl-sidebar-action-grid">
                    <button
                        type="button"
                        className="rl-sidebar-chip"
                        onClick={() => onAppendJournalContext(activeJournalContext)}
                    >
                        Insert Active Tab
                    </button>
                    <button
                        type="button"
                        className="rl-sidebar-chip"
                        onClick={() => onAppendJournalContext(fullJournalContext)}
                    >
                        Insert Full Journal
                    </button>
                </div>
                <div className="rl-sidebar-panel-copy">
                    Active tab:
                    {" "}
                    <span className="rl-sidebar-inline-code">
                        {findJournalSection(journalState.config.activeTab).label}
                    </span>
                </div>
            </div>

            {lastDirective ? (
                <div className="rl-sidebar-panel-copy">
                    Last directive:
                    {" "}
                    <span className="rl-sidebar-inline-code">{lastDirective}</span>
                </div>
            ) : null}

            {lastFeedback ? (
                <div className={`rl-sidebar-status ${lastFeedback.kind}`}>{lastFeedback.text}</div>
            ) : (
                <div className="rl-sidebar-status info">
                    Server feedback will appear here after the command response arrives.
                </div>
            )}

            <div className="rl-sidebar-panel-copy">
                Tip:
                {" "}
                <span className="rl-sidebar-inline-code">Ctrl/Cmd + Enter</span>
                {" "}
                sends the current directive.
            </div>
        </div>
    );
}

function GroundItemsPanel({ osrsClient }: { osrsClient: OsrsClient }): JSX.Element {
    const plugin = osrsClient.groundItemsPlugin;
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const config = state.config;

    const update = useCallback(
        <K extends keyof GroundItemsPluginConfig>(key: K, value: GroundItemsPluginConfig[K]) => {
            plugin.setConfig({ [key]: value } as Partial<GroundItemsPluginConfig>);
        },
        [plugin],
    );

    return (
        <div className="rl-sidebar-panel-content rl-sidebar-scrollable">
            <div className="rl-sidebar-panel-title">Ground Items</div>
            <p className="rl-sidebar-panel-copy">
                RuneLite-style filtering, highlighting, and value coloring for item labels.
            </p>
            {!config.enabled && (
                <p className="rl-sidebar-panel-copy">
                    Plugin is currently disabled in -scape.
                </p>
            )}

            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.showHighlightedOnly}
                    onChange={(event) => update("showHighlightedOnly", event.target.checked)}
                />
                <span>Show highlighted items only</span>
            </label>

            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.showMenuItemQuantities}
                    onChange={(event) => update("showMenuItemQuantities", event.target.checked)}
                />
                <span>Show menu item quantities</span>
            </label>

            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.recolorMenuHiddenItems}
                    onChange={(event) => update("recolorMenuHiddenItems", event.target.checked)}
                />
                <span>Recolor hidden menu entries</span>
            </label>

            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.rightClickHidden}
                    onChange={(event) => update("rightClickHidden", event.target.checked)}
                />
                <span>Right click hidden items</span>
            </label>

            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.dontHideUntradeables}
                    onChange={(event) => update("dontHideUntradeables", event.target.checked)}
                />
                <span>Do not hide untradeables</span>
            </label>

            <div className="rl-sidebar-row">
                <label className="rl-sidebar-field">
                    <span>Price display mode</span>
                    <select
                        value={config.priceDisplayMode}
                        onChange={(event) =>
                            update(
                                "priceDisplayMode",
                                event.target.value as GroundItemsPluginConfig["priceDisplayMode"],
                            )
                        }
                    >
                        <option value="both">Both</option>
                        <option value="ge">Grand Exchange</option>
                        <option value="ha">High Alchemy</option>
                        <option value="off">Off</option>
                    </select>
                </label>
                <label className="rl-sidebar-field">
                    <span>Ownership filter</span>
                    <select
                        value={config.ownershipFilterMode}
                        onChange={(event) =>
                            update(
                                "ownershipFilterMode",
                                event.target
                                    .value as GroundItemsPluginConfig["ownershipFilterMode"],
                            )
                        }
                    >
                        <option value="all">All</option>
                        <option value="takeable">Takeable</option>
                        <option value="drops">Drops</option>
                    </select>
                </label>
            </div>

            <div className="rl-sidebar-row">
                <label className="rl-sidebar-field">
                    <span>Value mode</span>
                    <select
                        value={config.valueCalculationMode}
                        onChange={(event) =>
                            update(
                                "valueCalculationMode",
                                event.target
                                    .value as GroundItemsPluginConfig["valueCalculationMode"],
                            )
                        }
                    >
                        <option value="highest">Highest</option>
                        <option value="ge">Grand Exchange</option>
                        <option value="ha">High Alchemy</option>
                    </select>
                </label>
                <label className="rl-sidebar-field">
                    <span>Despawn timer</span>
                    <select
                        value={config.despawnTimerMode}
                        onChange={(event) =>
                            update(
                                "despawnTimerMode",
                                event.target.value as GroundItemsPluginConfig["despawnTimerMode"],
                            )
                        }
                    >
                        <option value="off">Off</option>
                        <option value="ticks">Ticks</option>
                        <option value="seconds">Seconds</option>
                    </select>
                </label>
            </div>

            <label className="rl-sidebar-field">
                <span>Hide under value</span>
                <input
                    type="number"
                    min={0}
                    value={config.hideUnderValue}
                    onChange={(event) =>
                        update(
                            "hideUnderValue",
                            parseInteger(event.target.value, config.hideUnderValue),
                        )
                    }
                />
            </label>

            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>Low value</span>
                    <input
                        type="number"
                        min={0}
                        value={config.lowValuePrice}
                        onChange={(event) =>
                            update(
                                "lowValuePrice",
                                parseInteger(event.target.value, config.lowValuePrice),
                            )
                        }
                    />
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.lowValueColor)}
                    onChange={(event) =>
                        update(
                            "lowValueColor",
                            parseColorInput(event.target.value, config.lowValueColor),
                        )
                    }
                    title="Low value color"
                />
            </div>

            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>Medium value</span>
                    <input
                        type="number"
                        min={0}
                        value={config.mediumValuePrice}
                        onChange={(event) =>
                            update(
                                "mediumValuePrice",
                                parseInteger(event.target.value, config.mediumValuePrice),
                            )
                        }
                    />
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.mediumValueColor)}
                    onChange={(event) =>
                        update(
                            "mediumValueColor",
                            parseColorInput(event.target.value, config.mediumValueColor),
                        )
                    }
                    title="Medium value color"
                />
            </div>

            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>High value</span>
                    <input
                        type="number"
                        min={0}
                        value={config.highValuePrice}
                        onChange={(event) =>
                            update(
                                "highValuePrice",
                                parseInteger(event.target.value, config.highValuePrice),
                            )
                        }
                    />
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.highValueColor)}
                    onChange={(event) =>
                        update(
                            "highValueColor",
                            parseColorInput(event.target.value, config.highValueColor),
                        )
                    }
                    title="High value color"
                />
            </div>

            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>Insane value</span>
                    <input
                        type="number"
                        min={0}
                        value={config.insaneValuePrice}
                        onChange={(event) =>
                            update(
                                "insaneValuePrice",
                                parseInteger(event.target.value, config.insaneValuePrice),
                            )
                        }
                    />
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.insaneValueColor)}
                    onChange={(event) =>
                        update(
                            "insaneValueColor",
                            parseColorInput(event.target.value, config.insaneValueColor),
                        )
                    }
                    title="Insane value color"
                />
            </div>

            <div className="rl-sidebar-row">
                <label className="rl-sidebar-field">
                    <span>Default color</span>
                    <input
                        className="rl-sidebar-color-input rl-sidebar-color-full"
                        type="color"
                        value={toColorInput(config.defaultColor)}
                        onChange={(event) =>
                            update(
                                "defaultColor",
                                parseColorInput(event.target.value, config.defaultColor),
                            )
                        }
                        title="Default item color"
                    />
                </label>
                <label className="rl-sidebar-field">
                    <span>Highlighted color</span>
                    <input
                        className="rl-sidebar-color-input rl-sidebar-color-full"
                        type="color"
                        value={toColorInput(config.highlightedColor)}
                        onChange={(event) =>
                            update(
                                "highlightedColor",
                                parseColorInput(event.target.value, config.highlightedColor),
                            )
                        }
                        title="Explicit highlighted item color"
                    />
                </label>
                <label className="rl-sidebar-field">
                    <span>Hidden color</span>
                    <input
                        className="rl-sidebar-color-input rl-sidebar-color-full"
                        type="color"
                        value={toColorInput(config.hiddenColor)}
                        onChange={(event) =>
                            update(
                                "hiddenColor",
                                parseColorInput(event.target.value, config.hiddenColor),
                            )
                        }
                        title="Hidden item color"
                    />
                </label>
            </div>

            <label className="rl-sidebar-field">
                <span>Highlighted items (CSV, supports * wildcard)</span>
                <textarea
                    className="rl-sidebar-textarea"
                    rows={3}
                    value={config.highlightedItems}
                    onChange={(event) => update("highlightedItems", event.target.value)}
                />
            </label>

            <label className="rl-sidebar-field">
                <span>Hidden items (CSV, supports * wildcard)</span>
                <textarea
                    className="rl-sidebar-textarea"
                    rows={3}
                    value={config.hiddenItems}
                    onChange={(event) => update("hiddenItems", event.target.value)}
                />
            </label>
        </div>
    );
}

function InteractHighlightPanel({ osrsClient }: { osrsClient: OsrsClient }): JSX.Element {
    const plugin = osrsClient.interactHighlightPlugin;
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const config = state.config;

    const update = useCallback(
        <K extends keyof InteractHighlightPluginConfig>(
            key: K,
            value: InteractHighlightPluginConfig[K],
        ) => {
            plugin.setConfig({ [key]: value } as Partial<InteractHighlightPluginConfig>);
        },
        [plugin],
    );

    return (
        <div className="rl-sidebar-panel-content rl-sidebar-scrollable">
            <div className="rl-sidebar-panel-title">Interact Highlight</div>
            <p className="rl-sidebar-panel-copy">
                RuneLite-style object highlight. Hover is blue and active interaction is red.
            </p>
            {!config.enabled && (
                <p className="rl-sidebar-panel-copy">
                    Plugin is currently disabled in -scape.
                </p>
            )}
            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.showHover}
                    onChange={(event) => update("showHover", event.target.checked)}
                />
                <span>Show hover highlight</span>
            </label>
            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.showInteract}
                    onChange={(event) => update("showInteract", event.target.checked)}
                />
                <span>Show interaction highlight</span>
            </label>
            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>Hover color</span>
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.hoverColor)}
                    onChange={(event) =>
                        update("hoverColor", parseColorInput(event.target.value, config.hoverColor))
                    }
                    title="Hover highlight color"
                />
            </div>
            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>Interact color</span>
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.interactColor)}
                    onChange={(event) =>
                        update(
                            "interactColor",
                            parseColorInput(event.target.value, config.interactColor),
                        )
                    }
                    title="Interaction highlight color"
                />
            </div>
        </div>
    );
}

function TileMarkersPanel({ osrsClient }: { osrsClient: OsrsClient }): JSX.Element {
    const plugin = osrsClient.tileMarkersPlugin;
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const config = state.config;

    const update = useCallback(
        <K extends keyof TileMarkersPluginConfig>(key: K, value: TileMarkersPluginConfig[K]) => {
            plugin.setConfig({ [key]: value } as Partial<TileMarkersPluginConfig>);
        },
        [plugin],
    );

    return (
        <div className="rl-sidebar-panel-content rl-sidebar-scrollable">
            <div className="rl-sidebar-panel-title">Tile Markers</div>
            <p className="rl-sidebar-panel-copy">
                RuneLite-style destination and true tile indicators for your player.
            </p>
            {!config.enabled && (
                <p className="rl-sidebar-panel-copy">
                    Plugin is currently disabled in -scape.
                </p>
            )}
            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.showDestinationTile}
                    onChange={(event) => update("showDestinationTile", event.target.checked)}
                />
                <span>Highlight destination tile</span>
            </label>
            <label className="rl-sidebar-check">
                <input
                    type="checkbox"
                    checked={config.showCurrentTile}
                    onChange={(event) => update("showCurrentTile", event.target.checked)}
                />
                <span>Highlight true tile</span>
            </label>
            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>Destination color</span>
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.destinationTileColor)}
                    onChange={(event) =>
                        update(
                            "destinationTileColor",
                            parseColorInput(event.target.value, config.destinationTileColor),
                        )
                    }
                    title="Destination tile color"
                />
            </div>
            <div className="rl-sidebar-row rl-sidebar-value-row">
                <label className="rl-sidebar-field">
                    <span>True tile color</span>
                </label>
                <input
                    className="rl-sidebar-color-input"
                    type="color"
                    value={toColorInput(config.currentTileColor)}
                    onChange={(event) =>
                        update(
                            "currentTileColor",
                            parseColorInput(event.target.value, config.currentTileColor),
                        )
                    }
                    title="True tile color"
                />
            </div>
        </div>
    );
}

function PluginHubPanel({ osrsClient }: { osrsClient: OsrsClient }): JSX.Element {
    type PluginHubToggle = {
        id: string;
        name: string;
        description: string;
        enabled: boolean;
        setEnabled: (enabled: boolean) => void;
    };

    const groundItemsPlugin = osrsClient.groundItemsPlugin;
    const groundItemsSubscribe = useCallback(
        (listener: () => void) => groundItemsPlugin.subscribe(listener),
        [groundItemsPlugin],
    );
    const groundItemsGetSnapshot = useCallback(
        () => groundItemsPlugin.getState(),
        [groundItemsPlugin],
    );
    const groundItemsState = useSyncExternalStore(
        groundItemsSubscribe,
        groundItemsGetSnapshot,
        groundItemsGetSnapshot,
    );

    const notesPlugin = osrsClient.notesPlugin;
    const notesSubscribe = useCallback(
        (listener: () => void) => notesPlugin.subscribe(listener),
        [notesPlugin],
    );
    const notesGetSnapshot = useCallback(() => notesPlugin.getState(), [notesPlugin]);
    const notesState = useSyncExternalStore(notesSubscribe, notesGetSnapshot, notesGetSnapshot);

    const interactHighlightPlugin = osrsClient.interactHighlightPlugin;
    const interactHighlightSubscribe = useCallback(
        (listener: () => void) => interactHighlightPlugin.subscribe(listener),
        [interactHighlightPlugin],
    );
    const interactHighlightGetSnapshot = useCallback(
        () => interactHighlightPlugin.getState(),
        [interactHighlightPlugin],
    );
    const interactHighlightState = useSyncExternalStore(
        interactHighlightSubscribe,
        interactHighlightGetSnapshot,
        interactHighlightGetSnapshot,
    );

    const tileMarkersPlugin = osrsClient.tileMarkersPlugin;
    const tileMarkersSubscribe = useCallback(
        (listener: () => void) => tileMarkersPlugin.subscribe(listener),
        [tileMarkersPlugin],
    );
    const tileMarkersGetSnapshot = useCallback(
        () => tileMarkersPlugin.getState(),
        [tileMarkersPlugin],
    );
    const tileMarkersState = useSyncExternalStore(
        tileMarkersSubscribe,
        tileMarkersGetSnapshot,
        tileMarkersGetSnapshot,
    );

    const pluginToggles = useMemo<PluginHubToggle[]>(
        () => [
            {
                id: "ground_items",
                name: "Ground Items",
                description: "Highlights, filters, and recolors item labels.",
                enabled: groundItemsState.config.enabled,
                setEnabled: (enabled: boolean) => {
                    groundItemsPlugin.setConfig({ enabled });
                },
            },
            {
                id: "interact_highlight",
                name: "Interact Highlight",
                description: "Highlights hovered and interacted world objects.",
                enabled: interactHighlightState.config.enabled,
                setEnabled: (enabled: boolean) => {
                    interactHighlightPlugin.setConfig({ enabled });
                },
            },
            {
                id: "tile_markers",
                name: "Tile Markers",
                description: "Highlights destination and true tile positions.",
                enabled: tileMarkersState.config.enabled,
                setEnabled: (enabled: boolean) => {
                    tileMarkersPlugin.setConfig({ enabled });
                },
            },
            {
                id: "notes",
                name: "Agent Journal",
                description: "Persistent journal tabs for scripts, people, memories, and financial status.",
                enabled: notesState.config.enabled,
                setEnabled: (enabled: boolean) => {
                    notesPlugin.setConfig({ enabled });
                },
            },
        ],
        [
            groundItemsPlugin,
            groundItemsState.config.enabled,
            interactHighlightPlugin,
            interactHighlightState.config.enabled,
            notesPlugin,
            notesState.config.enabled,
            tileMarkersPlugin,
            tileMarkersState.config.enabled,
        ],
    );

    return (
        <div className="rl-sidebar-panel-content rl-sidebar-scrollable">
            <div className="rl-sidebar-panel-title">-scape</div>
            <p className="rl-sidebar-panel-copy">
                Enable or disable plugins. Toggle states persist in local storage.
            </p>
            {pluginToggles.map((plugin) => (
                <label key={plugin.id} className="rl-sidebar-plugin-toggle">
                    <span className="rl-sidebar-plugin-meta">
                        <span className="rl-sidebar-plugin-name">{plugin.name}</span>
                        <span className="rl-sidebar-plugin-desc">{plugin.description}</span>
                    </span>
                    <input
                        type="checkbox"
                        checked={plugin.enabled}
                        onChange={(event) => plugin.setEnabled(event.target.checked)}
                        aria-label={`Enable ${plugin.name} plugin`}
                    />
                </label>
            ))}
        </div>
    );
}

export interface SidebarPanelRenderContext {
    osrsClient: OsrsClient;
    selectedEntryId: string;
}

export type SidebarPanelRenderer = (ctx: SidebarPanelRenderContext) => JSX.Element;

export interface SidebarShellProps {
    osrsClient: OsrsClient;
    store: SidebarStore<ClientSidebarEntryData>;
    panelRenderers?: Record<SidebarPanelId, SidebarPanelRenderer>;
}

const DEFAULT_PANEL_RENDERERS: Record<string, SidebarPanelRenderer> = {
    plugin_hub: (ctx) => <PluginHubPanel osrsClient={ctx.osrsClient} />,
    bot_sdk: (ctx) => <BotSdkPanel osrsClient={ctx.osrsClient} />,
    ground_items: (ctx) => <GroundItemsPanel osrsClient={ctx.osrsClient} />,
    interact_highlight: (ctx) => <InteractHighlightPanel osrsClient={ctx.osrsClient} />,
    tile_markers: (ctx) => <TileMarkersPanel osrsClient={ctx.osrsClient} />,
    notes: (ctx) => <SidebarJournalPanel osrsClient={ctx.osrsClient} />,
};

export function SidebarShell({
    osrsClient,
    store,
    panelRenderers,
}: SidebarShellProps): JSX.Element {
    const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
    const getSnapshot = useCallback(() => store.getState(), [store]);

    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const selectedEntry = useMemo(() => {
        if (!state.selectedId) return undefined;
        return state.entries.find((entry) => entry.id === state.selectedId);
    }, [state.entries, state.selectedId]);
    const pluginHubEntry = useMemo(
        () => state.entries.find((entry) => entry.id === "plugin_hub"),
        [state.entries],
    );

    const resolvedRenderers = useMemo(
        () => ({
            ...DEFAULT_PANEL_RENDERERS,
            ...(panelRenderers ? panelRenderers : {}),
        }),
        [panelRenderers],
    );

    const selectedPanelId = selectedEntry?.data?.panelId;
    const panelRenderer = selectedPanelId ? resolvedRenderers[selectedPanelId] : undefined;
    const shouldShowPanel =
        state.open && selectedEntry !== undefined && panelRenderer !== undefined;
    const drawerTitle = selectedEntry?.title ?? pluginHubEntry?.title ?? "Plugins";

    useEffect(() => {
        if (!shouldShowPanel) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                store.setOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shouldShowPanel, store]);

    const onDrawerToggle = useCallback(() => {
        if (state.open) {
            store.setOpen(false);
            return;
        }

        if (state.selectedId) {
            store.setOpen(true);
            return;
        }

        const fallbackEntryId =
            pluginHubEntry?.id ?? (state.entries[0] ? state.entries[0].id : null);
        if (fallbackEntryId) {
            store.select(fallbackEntryId);
        }
    }, [pluginHubEntry, state.entries, state.open, state.selectedId, store]);

    const onEntryClick = useCallback(
        (entryId: string) => {
            if (state.open && state.selectedId === entryId) {
                store.setOpen(false);
                return;
            }
            store.select(entryId);
        },
        [state.open, state.selectedId, store],
    );

    return (
        <div className={`rl-sidebar-root ${shouldShowPanel ? "open" : "closed"}`}>
            <button
                type="button"
                className="rl-sidebar-backdrop"
                onClick={() => store.setOpen(false)}
                aria-label="Close sidebar"
                tabIndex={shouldShowPanel ? 0 : -1}
            />
            <button
                type="button"
                className={`rl-sidebar-toggle ${shouldShowPanel ? "active" : ""}`}
                onClick={onDrawerToggle}
                aria-label={shouldShowPanel ? "Collapse sidebar" : "Open sidebar"}
                aria-expanded={shouldShowPanel}
                aria-hidden={shouldShowPanel}
                tabIndex={shouldShowPanel ? -1 : 0}
                title={shouldShowPanel ? "Collapse sidebar" : "Open sidebar"}
            >
                <SidebarToggleGlyph open={shouldShowPanel} />
            </button>
            <aside className="rl-sidebar-drawer" aria-hidden={!shouldShowPanel}>
                <div className="rl-sidebar-drawer-header">
                    <div className="rl-sidebar-heading">
                        <div className="rl-sidebar-heading-kicker">-scape</div>
                        <div className="rl-sidebar-heading-title">{drawerTitle}</div>
                    </div>
                    <button
                        type="button"
                        className="rl-sidebar-close"
                        onClick={() => store.setOpen(false)}
                        aria-label="Close sidebar"
                        title="Close sidebar"
                    >
                        <SidebarToggleGlyph open={true} />
                    </button>
                </div>
                <div className="rl-sidebar-buttons">
                    {state.entries.map((entry) => {
                        const active = state.selectedId === entry.id;
                        const icon = entry.data?.icon;
                        return (
                            <button
                                key={entry.id}
                                type="button"
                                className={`rl-sidebar-button ${active ? "active" : ""}`}
                                onClick={() => onEntryClick(entry.id)}
                                aria-label={entry.title}
                                title={entry.tooltip ? entry.tooltip : entry.title}
                            >
                                <SidebarRailIcon icon={icon} label={entry.title} />
                            </button>
                        );
                    })}
                </div>
                {shouldShowPanel && panelRenderer && selectedEntry && (
                    <section className="rl-sidebar-panel">
                        {panelRenderer({
                            osrsClient,
                            selectedEntryId: selectedEntry.id,
                        })}
                    </section>
                )}
            </aside>
        </div>
    );
}
