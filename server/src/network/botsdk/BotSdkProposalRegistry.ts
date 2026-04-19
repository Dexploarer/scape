import type { AgentScriptSpec } from "../../agent";

export interface BotSdkScriptProposalRecord {
    proposalId: string;
    playerId: number;
    agentId: string;
    displayName: string;
    principalId?: string;
    worldCharacterId?: string;
    summary?: string;
    script: AgentScriptSpec;
    proposedAt: number;
}

export class BotSdkProposalRegistry {
    private readonly proposals = new Map<string, BotSdkScriptProposalRecord>();

    upsert(record: BotSdkScriptProposalRecord): BotSdkScriptProposalRecord {
        this.proposals.set(record.proposalId, record);
        return record;
    }

    get(proposalId: string): BotSdkScriptProposalRecord | undefined {
        return this.proposals.get(proposalId);
    }

    remove(proposalId: string): BotSdkScriptProposalRecord | undefined {
        const existing = this.proposals.get(proposalId);
        if (existing) {
            this.proposals.delete(proposalId);
        }
        return existing;
    }

    removeByPlayerId(playerId: number): BotSdkScriptProposalRecord[] {
        const removed: BotSdkScriptProposalRecord[] = [];
        for (const entry of this.proposals.values()) {
            if ((entry.playerId | 0) !== (playerId | 0)) {
                continue;
            }
            removed.push(entry);
            this.proposals.delete(entry.proposalId);
        }
        return removed;
    }

    list(targetPlayerId?: number): BotSdkScriptProposalRecord[] {
        const entries = Array.from(this.proposals.values());
        return entries
            .filter((entry) =>
                targetPlayerId === undefined ? true : (entry.playerId | 0) === (targetPlayerId | 0),
            )
            .sort((a, b) => b.proposedAt - a.proposedAt || a.proposalId.localeCompare(b.proposalId));
    }
}
