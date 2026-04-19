import type {
    AgentFreshDelta,
    AgentProfileRow,
    AgentPromptAffordanceSlotRow,
    AgentPromptAssemblyInput,
    AgentPromptObjectiveSlotRow,
    AgentPromptRecentEventSlotRow,
    AgentPromptSelfSlotRow,
    AgentRuntimeSessionRow,
} from "../../../src/shared/agent-context";

import type { AgentPerceptionEvent, AgentPerceptionSnapshot } from "./AgentPerception";
import type {
    ActionResultFrame,
    EventFrame,
} from "../network/botsdk/BotSdkProtocol";

const DEFAULT_MAX_AFFORDANCES = 12;
const DEFAULT_INVENTORY_CAPACITY = 28;

type SnapshotConstraints = {
    freeInventorySlots: number;
    inventoryFull: boolean;
    lowHp: boolean;
    moving: boolean;
    movementLocked: boolean;
    bankOpen: boolean;
    dialogueOpen: boolean;
};

function clampScore(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string): string {
    return value.trim().toLowerCase();
}

function tokenize(value: string | undefined): string[] {
    if (!value) return [];
    return normalizeText(value)
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 3);
}

function tokenOverlapBoost(label: string, objective: AgentPromptObjectiveSlotRow | undefined): number {
    if (!objective) return 0;
    const objectiveTokens = new Set(
        tokenize(`${objective.goal} ${objective.summary ?? ""} ${objective.operatorDirective ?? ""}`),
    );
    if (objectiveTokens.size === 0) return 0;
    const labelTokens = tokenize(label);
    if (labelTokens.length === 0) return 0;
    let overlap = 0;
    for (const token of labelTokens) {
        if (objectiveTokens.has(token)) overlap += 1;
    }
    return Math.min(0.25, overlap * 0.08);
}

function distancePenalty(distance: number | undefined): number {
    if (distance == null || distance < 0) return 0;
    return Math.min(0.3, distance * 0.015);
}

function classifyObjectKind(name: string): "bank" | "resource" | "traversal" | "utility" | "object" {
    const normalized = normalizeText(name);
    if (/(bank|booth|deposit|chest)/.test(normalized)) return "bank";
    if (/(rock|ore|tree|stump|fishing|spot|anvil|furnace|range|altar)/.test(normalized)) {
        return "resource";
    }
    if (/(door|gate|ladder|stairs|staircase|trapdoor|portal)/.test(normalized)) {
        return "traversal";
    }
    if (/(lever|switch|fountain|crate|sack|table)/.test(normalized)) return "utility";
    return "object";
}

function getConstraints(snapshot: AgentPerceptionSnapshot): SnapshotConstraints {
    const provided = (snapshot as AgentPerceptionSnapshot & {
        constraints?: Partial<SnapshotConstraints>;
    }).constraints;
    const freeInventorySlots =
        provided?.freeInventorySlots ??
        Math.max(0, DEFAULT_INVENTORY_CAPACITY - snapshot.inventory.length);
    const inventoryFull = provided?.inventoryFull ?? freeInventorySlots <= 0;
    const lowHp =
        provided?.lowHp ??
        snapshot.self.hp <= Math.max(1, Math.ceil(snapshot.self.maxHp * 0.35));
    return {
        freeInventorySlots,
        inventoryFull,
        lowHp,
        moving: provided?.moving ?? false,
        movementLocked: provided?.movementLocked ?? false,
        bankOpen: provided?.bankOpen ?? false,
        dialogueOpen: provided?.dialogueOpen ?? false,
    };
}

function scoreObjectAffordance(
    kind: AgentPromptAffordanceSlotRow["kind"],
    distance: number | undefined,
    objective: AgentPromptObjectiveSlotRow | undefined,
    label: string,
    constraints: SnapshotConstraints,
): number {
    let base =
        kind === "bank"
            ? constraints.inventoryFull || constraints.bankOpen
                ? 0.92
                : 0.58
            : kind === "resource"
                ? 0.67
                : kind === "traversal"
                    ? 0.36
                    : kind === "utility"
                        ? 0.43
                        : 0.39;
    base += tokenOverlapBoost(label, objective);
    return clampScore(base - distancePenalty(distance));
}

function scoreLootAffordance(
    distance: number | undefined,
    objective: AgentPromptObjectiveSlotRow | undefined,
    label: string,
    constraints: SnapshotConstraints,
): number {
    let base = constraints.inventoryFull ? 0.18 : 0.73;
    base += tokenOverlapBoost(label, objective);
    return clampScore(base - distancePenalty(distance));
}

function scoreNpcAffordance(
    distance: number | undefined,
    objective: AgentPromptObjectiveSlotRow | undefined,
    label: string,
    constraints: SnapshotConstraints,
    snapshot: AgentPerceptionSnapshot,
): number {
    let base = constraints.lowHp ? 0.12 : 0.48;
    if (snapshot.self.inCombat) base -= 0.1;
    base += tokenOverlapBoost(label, objective);
    return clampScore(base - distancePenalty(distance));
}

export function projectSnapshotToPromptSelfSlot(
    agentId: string,
    snapshot: AgentPerceptionSnapshot,
): AgentPromptSelfSlotRow {
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
        freeInventorySlots: constraints.freeInventorySlots,
        inventoryFull: constraints.inventoryFull,
        lowHp: constraints.lowHp,
        moving: constraints.moving,
        movementLocked: constraints.movementLocked,
        bankOpen: constraints.bankOpen,
        dialogueOpen: constraints.dialogueOpen,
    };
}

export function projectSnapshotToRecentEventSlots(
    agentId: string,
    snapshot: AgentPerceptionSnapshot,
): AgentPromptRecentEventSlotRow[] {
    return [...snapshot.recentEvents]
        .reverse()
        .map((event, index) => ({
            slotId: `recent:${agentId}:${event.timestamp}:${index}`,
            agentId,
            rank: index + 1,
            kind: event.kind,
            message: event.message,
            occurredAt: event.timestamp,
        }));
}

export function inferAffordanceSlotsFromSnapshot(
    agentId: string,
    snapshot: AgentPerceptionSnapshot,
    objective?: AgentPromptObjectiveSlotRow,
    maxAffordances = DEFAULT_MAX_AFFORDANCES,
): AgentPromptAffordanceSlotRow[] {
    const constraints = getConstraints(snapshot);
    const affordances: AgentPromptAffordanceSlotRow[] = [];

    for (const object of snapshot.nearbyObjects) {
        const kind = classifyObjectKind(object.name);
        const label =
            kind === "bank"
                ? `open ${object.name}`
                : kind === "resource"
                    ? `interact ${object.name}`
                    : `use ${object.name}`;
        const distance =
            object.distance ??
            Math.max(
                Math.abs(snapshot.self.x - object.x),
                Math.abs(snapshot.self.z - object.z),
            );
        affordances.push({
            slotId: `object:${object.locId}:${object.x}:${object.z}`,
            agentId,
            kind,
            label,
            reachable: true,
            distance,
            score: scoreObjectAffordance(
                kind,
                distance,
                objective,
                `${label} ${object.name}`,
                constraints,
            ),
            targetType: "object",
            targetId: String(object.locId),
        });
    }

    for (const item of snapshot.nearbyGroundItems) {
        const distance =
            item.distance ??
            Math.max(
                Math.abs(snapshot.self.x - item.x),
                Math.abs(snapshot.self.z - item.z),
            );
        affordances.push({
            slotId: `ground_item:${item.itemId}:${item.x}:${item.z}`,
            agentId,
            kind: "loot",
            label: `pick up ${item.name}`,
            reachable: !constraints.inventoryFull,
            distance,
            score: scoreLootAffordance(distance, objective, item.name, constraints),
            targetType: "ground_item",
            targetId: String(item.itemId),
            reasonUnavailable: constraints.inventoryFull ? "inventory_full" : undefined,
        });
    }

    for (const npc of snapshot.nearbyNpcs) {
        const distance =
            npc.distance ??
            Math.max(
                Math.abs(snapshot.self.x - npc.x),
                Math.abs(snapshot.self.z - npc.z),
            );
        affordances.push({
            slotId: `npc:${npc.id}`,
            agentId,
            kind: constraints.lowHp ? "threat" : "combat",
            label: constraints.lowHp ? `avoid ${npc.name}` : `attack ${npc.name}`,
            reachable: !constraints.lowHp,
            distance,
            score: scoreNpcAffordance(distance, objective, npc.name, constraints, snapshot),
            targetType: "npc",
            targetId: String(npc.id),
            reasonUnavailable: constraints.lowHp ? "low_hp" : undefined,
        });
    }

    return affordances
        .sort(
            (a, b) =>
                b.score - a.score ||
                Number(b.reachable) - Number(a.reachable) ||
                (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER) ||
                a.slotId.localeCompare(b.slotId),
        )
        .slice(0, maxAffordances);
}

export function toFreshDeltaFromActionResult(frame: ActionResultFrame): AgentFreshDelta {
    return {
        kind: "action_result",
        correlationId: frame.correlationId,
        status: frame.status,
        code: frame.code,
        message: frame.message,
    };
}

export function toFreshDeltaFromEvent(frame: EventFrame | AgentPerceptionEvent): AgentFreshDelta {
    if (typeof (frame as AgentPerceptionEvent).message === "string") {
        return {
            kind: "event",
            eventKind: (frame as AgentPerceptionEvent).kind,
            code: (frame as AgentPerceptionEvent).kind,
            message: (frame as AgentPerceptionEvent).message,
        };
    }
    const runtime = frame as EventFrame;
    const eventKind = runtime.name ?? runtime.event ?? "event";
    const message =
        typeof runtime.payload?.message === "string"
            ? runtime.payload.message
            : eventKind;
    return {
        kind: "event",
        eventKind,
        code: eventKind,
        message,
    };
}

export interface BuildProjectedPromptAssemblyInputOptions {
    profile: AgentProfileRow;
    snapshot: AgentPerceptionSnapshot;
    session?: AgentRuntimeSessionRow;
    objective?: AgentPromptObjectiveSlotRow;
    freshDelta?: AgentFreshDelta;
    maxAffordances?: number;
}

export function buildProjectedPromptAssemblyInput(
    options: BuildProjectedPromptAssemblyInputOptions,
): AgentPromptAssemblyInput {
    const agentId = options.profile.agentId;
    return {
        profile: options.profile,
        session: options.session,
        self: projectSnapshotToPromptSelfSlot(agentId, options.snapshot),
        objective: options.objective,
        affordances: inferAffordanceSlotsFromSnapshot(
            agentId,
            options.snapshot,
            options.objective,
            options.maxAffordances,
        ),
        recent: projectSnapshotToRecentEventSlots(agentId, options.snapshot),
        freshDelta: options.freshDelta,
    };
}
