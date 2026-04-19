/**
 * Bot-SDK wire protocol.
 *
 * Two separate sides — what the plugin sends to the server (`ClientFrame`)
 * and what the server sends back (`ServerFrame`). Both are encoded as TOON
 * at the transport layer. The shapes here are plain structural types; the
 * {@link BotSdkCodec} handles encoding/decoding without mirroring the types
 * manually.
 *
 * **Why these shapes are frozen now**: the milady `@elizaos/app-scape`
 * plugin copies these types verbatim into its own `src/sdk/types.ts`.
 * When you change anything here, update both sides in the same PR — the
 * codec round-trips by structural match, not a schema version.
 */

import type { AgentPerceptionSnapshot } from "../../agent";
import type { AgentScriptSpec } from "../../agent";

export type BotSdkFeature = "hostedSessions" | "liveEvents";

// ────────────────────────────────────────────────────────────────────────
//  Authentication / session frames
// ────────────────────────────────────────────────────────────────────────

/** First frame every client sends after the WebSocket opens. */
export interface AuthFrame {
    kind: "auth";
    /** Shared secret matching the server's `BOT_SDK_TOKEN`. */
    token: string;
    /** Optional protocol version bump (currently always 1). */
    version?: number;
    /** Optional client feature negotiation. Older clients may omit this. */
    features?: BotSdkFeature[];
}

/**
 * Client asks the server to spawn an agent-player instance.
 *
 * This is the bot-SDK's equivalent of the human-client "login" packet — the
 * server runs the exact same auth + persistence flow a real player would:
 * scrypt-verify the password via the {@link AccountStore} (auto-registering
 * a new account on first spawn), then load the persisted player state
 * (skills, inventory, bank, last position) via the `PlayerPersistence`
 * layer. The result is an agent that is indistinguishable from a human
 * player to the rest of the game engine — observable by other clients,
 * covered by the autosave timer, subject to combat rules, and carrying its
 * save file forward between sessions.
 */
export interface SpawnFrame {
    kind: "spawn";
    /** Stable agent id supplied by the plugin (distinct from the in-game username). */
    agentId: string;
    /** Requested in-game display name — becomes the account username in password mode. */
    displayName?: string;
    /**
     * Plaintext password used for scrypt verification / first-time account
     * creation. Travels over the bot-SDK WebSocket only; never logged.
     * Subject to the same minimum-length policy as human accounts
     * (AUTH_MIN_PASSWORD_LENGTH, default 8).
     */
    password?: string;
    /** Hosted Milady/ElizaOS session token. Mutually exclusive with password auth. */
    sessionToken?: string;
    /** Optional hosted world-character branch id expected by the session token. */
    worldCharacterId?: string;
    /** Optional world hint for older clients. Ignored unless it mismatches. */
    worldId?: string;
    /** Optional persona string fed into the LLM's system prompt. */
    persona?: string;
    /** Controller mode for this agent. Defaults to `"hybrid"`. */
    controller?: "llm" | "user" | "hybrid";
}

// ────────────────────────────────────────────────────────────────────────
//  Action frames (client → server)
// ────────────────────────────────────────────────────────────────────────

/** Every action shares these envelope fields. */
interface ActionEnvelope {
    kind: "action";
    /** Short action identifier; the router decides what to do with it. */
    action: string;
    /**
     * Correlation id — echoed back in the matching ack. Optional; if the
     * client doesn't care about the ack it can omit this.
     */
    correlationId?: string;
}

/** Walk to an absolute world tile. */
export interface WalkToAction extends ActionEnvelope {
    action: "walkTo";
    x: number;
    z: number;
    run?: boolean;
}

/** Send a public chat message as the agent player. */
export interface ChatPublicAction extends ActionEnvelope {
    action: "chatPublic";
    /**
     * Message text. Trimmed and clipped to a server-side max length
     * before broadcast; extra characters are dropped silently.
     */
    text: string;
}

/** Start combat against an NPC by unique instance id. */
export interface AttackNpcAction extends ActionEnvelope {
    action: "attackNpc";
    /** NPC instance id (not def id) — matches `NpcState.id`. */
    npcId: number;
}

/** Drop the item in the given inventory slot to the ground. */
export interface DropItemAction extends ActionEnvelope {
    action: "dropItem";
    /** Inventory slot index, 0..27. */
    slot: number;
}

/** Eat the food item in the given inventory slot. */
export interface EatFoodAction extends ActionEnvelope {
    action: "eatFood";
    /**
     * Inventory slot index. Optional — if omitted, the server picks
     * the first edible item in the agent's inventory.
     */
    slot?: number;
}

export interface InteractObjectAction extends ActionEnvelope {
    action: "interactObject";
    locId: number;
    x: number;
    z: number;
    level?: number;
    option?: string;
}

export interface BankDepositInventoryAction extends ActionEnvelope {
    action: "bankDepositInventory";
    tab?: number;
}

export type AnyActionFrame =
    | WalkToAction
    | ChatPublicAction
    | AttackNpcAction
    | DropItemAction
    | EatFoodAction
    | InteractObjectAction
    | BankDepositInventoryAction;

export interface ActionResultFrame {
    kind: "actionResult";
    correlationId?: string;
    status: "progress" | "success" | "failed" | "blocked" | "cancelled";
    code: string;
    message: string;
}

/** Client tells the server it's done with this agent session. */
export interface DisconnectFrame {
    kind: "disconnect";
    reason?: string;
}

export interface InstallScriptFrame {
    kind: "script";
    operation: "install";
    script: AgentScriptSpec;
    correlationId?: string;
}

export interface ClearScriptFrame {
    kind: "script";
    operation: "clear";
    reason?: string;
    correlationId?: string;
}

export interface InterruptScriptFrame {
    kind: "script";
    operation: "interrupt";
    interrupt: string;
    reason?: string;
    correlationId?: string;
}

export interface ScriptProposalFrame {
    kind: "proposal";
    proposalId?: string;
    summary?: string;
    script: AgentScriptSpec;
    correlationId?: string;
}

export type ScriptFrame =
    | InstallScriptFrame
    | ClearScriptFrame
    | InterruptScriptFrame;

/** All client-originated frames. */
export type ClientFrame =
    | AuthFrame
    | SpawnFrame
    | AnyActionFrame
    | DisconnectFrame
    | ScriptFrame
    | ScriptProposalFrame;

// ────────────────────────────────────────────────────────────────────────
//  Server frames (server → client)
// ────────────────────────────────────────────────────────────────────────

/** Successful auth — the session is now live. */
export interface AuthOkFrame {
    kind: "authOk";
    /** Human-readable server name. */
    server: string;
    /** Protocol version the server speaks. */
    version: number;
    /** Optional feature announcement for older clients. */
    features?: BotSdkFeature[];
}

/** Auth or spawn failed. Session is closed after this frame. */
export interface ErrorFrame {
    kind: "error";
    code: string;
    message: string;
}

/** Spawn succeeded — agent-player is in the world. */
export interface SpawnOkFrame {
    kind: "spawnOk";
    /** Player id assigned by the server. */
    playerId: number;
    /** Initial position. */
    x: number;
    z: number;
    level: number;
}

/**
 * Ack for a specific action frame — only sent when the original action
 * carried a `correlationId`. Failure acks carry a short reason.
 */
export interface ActionAckFrame {
    kind: "ack";
    correlationId: string;
    success: boolean;
    message?: string;
}

/** Full perception snapshot. Primary information delivery mechanism. */
export interface PerceptionFrame {
    kind: "perception";
    /** The snapshot itself — same shape as what the server holds internally. */
    snapshot: AgentPerceptionSnapshot;
}

/**
 * High-signal server event pushed to the agent outside the periodic
 * perception cadence. Agents can wake immediately on this frame instead
 * of waiting for the next perception emission.
 */
export interface RuntimeEventFrame {
    kind: "event";
    /** Typed game/runtime event name (for example `skill:levelUp`). */
    name?: string;
    /** Legacy alias still emitted by older BotSdkServer paths. */
    event?: string;
    /** Unix millis when the server emitted the event. */
    timestamp: number;
    /** Optional lightweight event payload. */
    payload?: Record<string, unknown>;
}

export type EventFrame = RuntimeEventFrame;

/**
 * An operator-steering directive pushed from the server to the agent.
 * Sent when a human player types `::steer <text>` in public chat while
 * the agent is connected, or when an HTTP POST /api/apps/scape/prompt
 * arrives on the milady side (though that path lives entirely in the
 * plugin and never touches this frame).
 *
 * The plugin's BotSdk receives this, invokes its `onOperatorCommand`
 * callback, and the game service injects the text into the next LLM
 * prompt as a high-priority steering instruction.
 */
export interface OperatorCommandFrame {
    kind: "operatorCommand";
    /**
     * Who issued the command. `"chat"` means a human player typed
     * `::steer …` in game; other sources may show up in later PRs
     * (for example `"admin"` for remote curators).
     */
    source: "chat" | "admin";
    /** The directive text. Already trimmed; may be empty to clear. */
    text: string;
    /** Unix millis when the command was received on the server. */
    timestamp: number;
    /**
     * Optional: the player id of the human who sent the steer, so
     * the plugin can log / acknowledge by name.
     */
    fromPlayerId?: number;
    fromPlayerName?: string;
}

export interface ProposalDecisionFrame {
    kind: "proposalDecision";
    proposalId: string;
    decision: "approved" | "rejected";
    installed?: boolean;
    message?: string;
}

/** All server-originated frames. */
export type ServerFrame =
    | AuthOkFrame
    | ErrorFrame
    | SpawnOkFrame
    | ActionAckFrame
    | PerceptionFrame
    | RuntimeEventFrame
    | OperatorCommandFrame
    | ProposalDecisionFrame;
