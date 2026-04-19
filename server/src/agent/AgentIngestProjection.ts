import type {
    AgentActionAttemptIngest,
    AgentActionOutcomeIngest,
    AgentDirectiveIngest,
    AgentPerceptionIngestBatch,
    AgentPerceptionObservationIngest,
    AgentProfileRow,
    AgentPromptObjectiveSlotRow,
    AgentRuntimeSessionRow,
    AgentSessionEndedIngest,
    AgentSessionStartedIngest,
} from "../../../src/shared/agent-context";

import type { AgentIdentity } from "./AgentIdentity";
import type { AgentPerceptionSnapshot } from "./AgentPerception";
import {
    buildProjectedPromptAssemblyInput,
    toFreshDeltaFromActionResult,
    toFreshDeltaFromEvent,
} from "./AgentContextProjection";
import { projectIdentityToProfileRow } from "./AgentPromptProjection";
import type {
    ActionResultFrame,
    AnyActionFrame,
    EventFrame,
    OperatorCommandFrame,
} from "../network/botsdk/BotSdkProtocol";

type SnapshotUi = {
    openInterface: string;
};

type SnapshotConstraints = {
    freeInventorySlots: number;
    inventoryFull: boolean;
    lowHp: boolean;
    moving: boolean;
    movementLocked: boolean;
    bankOpen: boolean;
    dialogueOpen: boolean;
};

function getOpenInterface(snapshot: AgentPerceptionSnapshot): string {
    const ui = (snapshot as AgentPerceptionSnapshot & { ui?: Partial<SnapshotUi> }).ui;
    return ui?.openInterface ?? "unknown";
}

function getConstraints(snapshot: AgentPerceptionSnapshot): SnapshotConstraints {
    const provided = (snapshot as AgentPerceptionSnapshot & {
        constraints?: Partial<SnapshotConstraints>;
    }).constraints;
    const freeInventorySlots =
        provided?.freeInventorySlots ?? Math.max(0, 28 - snapshot.inventory.length);
    return {
        freeInventorySlots,
        inventoryFull: provided?.inventoryFull ?? freeInventorySlots <= 0,
        lowHp:
            provided?.lowHp ??
            snapshot.self.hp <= Math.max(1, Math.ceil(snapshot.self.maxHp * 0.35)),
        moving: provided?.moving ?? false,
        movementLocked: provided?.movementLocked ?? false,
        bankOpen: provided?.bankOpen ?? false,
        dialogueOpen: provided?.dialogueOpen ?? false,
    };
}

export interface ProjectSessionStartedIngestOptions {
    identity: AgentIdentity;
    session: AgentRuntimeSessionRow;
    worldId: string;
    runtimeKind?: string;
    teamId?: string;
    startedAt?: number;
}

export function projectSessionStartedIngest(
    options: ProjectSessionStartedIngestOptions,
): AgentSessionStartedIngest {
    return {
        profile: projectIdentityToProfileRow(options.identity, {
            worldId: options.worldId,
            runtimeKind: options.runtimeKind,
            teamId: options.teamId,
        }),
        session: options.session,
        startedAt: options.startedAt ?? Date.now(),
    };
}

export function projectSessionEndedIngest(
    agentId: string,
    sessionId: string,
    endedAt: number,
    reason?: string,
): AgentSessionEndedIngest {
    return {
        agentId,
        sessionId,
        endedAt,
        reason,
    };
}

function buildPerceptionObservation(
    agentId: string,
    snapshot: AgentPerceptionSnapshot,
    observedAt: number,
): AgentPerceptionObservationIngest {
    const constraints = getConstraints(snapshot);
    return {
        agentId,
        tick: snapshot.tick,
        playerId: snapshot.self.id,
        x: snapshot.self.x,
        z: snapshot.self.z,
        level: snapshot.self.level,
        hp: snapshot.self.hp,
        maxHp: snapshot.self.maxHp,
        runEnergy: snapshot.self.runEnergy,
        inCombat: snapshot.self.inCombat,
        openInterface: getOpenInterface(snapshot),
        freeInventorySlots: constraints.freeInventorySlots,
        inventoryFull: constraints.inventoryFull,
        lowHp: constraints.lowHp,
        moving: constraints.moving,
        movementLocked: constraints.movementLocked,
        bankOpen: constraints.bankOpen,
        dialogueOpen: constraints.dialogueOpen,
        inventoryCount: snapshot.inventory.length,
        equipmentCount: snapshot.equipment.length,
        nearbyNpcCount: snapshot.nearbyNpcs.length,
        nearbyPlayerCount: snapshot.nearbyPlayers.length,
        nearbyGroundItemCount: snapshot.nearbyGroundItems.length,
        nearbyObjectCount: snapshot.nearbyObjects.length,
        recentEventCount: snapshot.recentEvents.length,
        observedAt,
    };
}

export interface ProjectPerceptionIngestBatchOptions {
    profile: AgentProfileRow;
    snapshot: AgentPerceptionSnapshot;
    session?: AgentRuntimeSessionRow;
    objective?: AgentPromptObjectiveSlotRow;
    observedAt?: number;
}

export function projectPerceptionIngestBatch(
    options: ProjectPerceptionIngestBatchOptions,
): AgentPerceptionIngestBatch {
    const input = buildProjectedPromptAssemblyInput({
        profile: options.profile,
        snapshot: options.snapshot,
        session: options.session,
        objective: options.objective,
    });
    return {
        profile: options.profile,
        session: options.session,
        objective: options.objective,
        self: input.self!,
        affordances: input.affordances ?? [],
        recent: input.recent ?? [],
        observation: buildPerceptionObservation(
            options.profile.agentId,
            options.snapshot,
            options.observedAt ?? Date.now(),
        ),
    };
}

export function projectActionAttemptIngest(
    agentId: string,
    playerId: number,
    frame: AnyActionFrame,
    recordedAt: number,
): AgentActionAttemptIngest {
    const base: AgentActionAttemptIngest = {
        agentId,
        playerId,
        action: frame.action,
        correlationId: frame.correlationId,
        recordedAt,
    };

    switch (frame.action) {
        case "walkTo":
            return {
                ...base,
                targetType: "tile",
                x: frame.x,
                z: frame.z,
                run: frame.run,
            };
        case "chatPublic":
            return {
                ...base,
                text: frame.text,
            };
        case "attackNpc":
            return {
                ...base,
                targetType: "npc",
                targetId: String(frame.npcId),
            };
        case "dropItem":
            return {
                ...base,
                targetType: "inventory_slot",
                slot: frame.slot,
            };
        case "eatFood":
            return {
                ...base,
                targetType: "inventory_slot",
                slot: frame.slot,
            };
        case "interactObject":
            return {
                ...base,
                targetType: "object",
                targetId: String(frame.locId),
                x: frame.x,
                z: frame.z,
                level: frame.level,
                option: frame.option,
            };
        case "bankDepositInventory":
            return {
                ...base,
                targetType: "bank",
                level: frame.tab,
            };
    }
}

export function projectActionOutcomeIngest(
    agentId: string,
    playerId: number,
    frame: ActionResultFrame,
    recordedAt: number,
): AgentActionOutcomeIngest {
    return {
        agentId,
        playerId,
        correlationId: frame.correlationId,
        status: frame.status,
        code: frame.code,
        message: frame.message,
        recordedAt,
    };
}

export function projectDirectiveIngest(
    agentId: string,
    frame: OperatorCommandFrame,
): AgentDirectiveIngest {
    return {
        agentId,
        source: frame.source,
        text: frame.text,
        timestamp: frame.timestamp,
        fromPlayerId: frame.fromPlayerId,
        fromPlayerName: frame.fromPlayerName,
    };
}

export function projectFreshDeltaForIngest(frame: ActionResultFrame | EventFrame) {
    return frame.kind === "actionResult"
        ? toFreshDeltaFromActionResult(frame)
        : toFreshDeltaFromEvent(frame);
}
