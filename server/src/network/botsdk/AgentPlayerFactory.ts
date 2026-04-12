/**
 * AgentPlayerFactory — the single entry point for spawning agent-controlled
 * players in xRSPS.
 *
 * Agents are **first-class accounts**. When the bot-SDK receives a spawn
 * frame, the factory runs the same auth + persistence flow a human login
 * would run:
 *
 *   1. Verify the submitted password against the {@link AccountStore}
 *      (auto-registering a new account on first spawn, subject to the
 *      shared minimum-length policy).
 *   2. Reject if the username is already in use by a human or another
 *      live agent session — `PlayerManager.hasConnectedPlayer` covers
 *      both cases.
 *   3. Create the headless `PlayerState` via `PlayerManager.addBot` so the
 *      entity is on the same tick + broadcast loop as any other player.
 *   4. Build a save key from the normalized name and call
 *      `PersistenceProvider.applyToPlayer` — restoring skills, inventory,
 *      bank, equipment, last position, account stage, and everything else
 *      the player-state JSON holds.
 *   5. Attach the `AgentComponent` so the agent layer (perception emitter,
 *      action router) recognizes the entity as agent-controlled.
 *
 * The factory is **synchronous** and returns a structured `{ok, ...}`
 * result rather than throwing — it's called directly from the bot-SDK
 * message loop, which needs to convert failures into TOON error frames
 * without losing the cause.
 */

import {
    type AccountAuthResult,
    type AccountStore,
} from "../../game/state/AccountStore";
import {
    buildScopedPlayerSaveKey,
    normalizePlayerAccountName,
} from "../../game/state/PlayerSessionKeys";
import type { PersistenceProvider } from "../../game/state/PersistenceProvider";
import type { HostedSessionService } from "../../auth/HostedSessionService";
import type { AgentComponent } from "../../agent";
import { AgentActionQueue } from "../../agent";
import type { GamemodeDefinition } from "../../game/gamemodes/GamemodeDefinition";
import type { PlayerManager, PlayerState } from "../../game/player";
import { logger } from "../../utils/logger";

export interface AgentSpawnRequest {
    /** Stable agent id from the milady runtime. */
    agentId: string;
    /** In-game display name (becomes the account username in password mode). */
    displayName?: string;
    /** Plaintext password for scrypt verification / auto-registration. */
    password?: string;
    /** Hosted Milady/ElizaOS session token. Mutually exclusive with password mode. */
    sessionToken?: string;
    /** Hosted world-scoped character branch. */
    worldCharacterId?: string;
    /** Controller mode for the first session. */
    controller: "llm" | "user" | "hybrid";
    /** Optional persona string fed into LLM prompts. */
    persona?: string;
}

export type AgentSpawnResult =
    | { ok: true; player: PlayerState; created: boolean; saveKey: string }
    | { ok: false; code: string; message: string };

export interface AgentPlayerFactoryDeps {
    players: () => PlayerManager | undefined;
    worldId: string;
    gamemode: GamemodeDefinition;
    accountStore: AccountStore;
    playerPersistence: PersistenceProvider;
    hostedSessionService?: HostedSessionService;
}

export class AgentPlayerFactory {
    constructor(private readonly deps: AgentPlayerFactoryDeps) {}

    /**
     * Authenticate an agent (creating the account on first spawn), load its
     * persisted game state, create the in-world entity, and attach the
     * agent component.
     */
    spawn(request: AgentSpawnRequest): AgentSpawnResult {
        const players = this.deps.players();
        if (!players) {
            return {
                ok: false,
                code: "not_ready",
                message: "Player manager not initialized — server still booting.",
            };
        }

        const hostedTokenMode =
            typeof request.sessionToken === "string" && request.sessionToken.length > 0;
        if (
            hostedTokenMode &&
            typeof request.password === "string" &&
            request.password.length > 0
        ) {
            return {
                ok: false,
                code: "mixed_auth_modes",
                message: "Use either password auth or hosted session auth, not both.",
            };
        }
        if (
            !hostedTokenMode &&
            (typeof request.password !== "string" || request.password.length === 0)
        ) {
            return {
                ok: false,
                code: "missing_password",
                message: "password must be a non-empty string.",
            };
        }
        let resolvedDisplayName = request.displayName;
        let normalized = normalizePlayerAccountName(resolvedDisplayName);
        if (!hostedTokenMode && !normalized) {
            return {
                ok: false,
                code: "invalid_name",
                message: "displayName must be a non-empty string.",
            };
        }
        let hostedWorldCharacterId: string | undefined;
        let created = false;

        // 1. Verify auth mode. Password mode shares the normal account
        //    store; hosted mode trusts a short-lived world ticket.
        //    human logins go through, same minimum-length rules, same
        //    registration-on-first-login semantics.
        if (hostedTokenMode) {
            const hosted = this.deps.hostedSessionService?.verify(request.sessionToken, {
                kind: "agent",
                worldId: this.deps.worldId,
                worldCharacterId: request.worldCharacterId,
                agentId: request.agentId,
            });
            if (!hosted || !hosted.ok) {
                return {
                    ok: false,
                    code: hosted?.code ?? "hosted_sessions_disabled",
                    message: hosted?.message ?? "Hosted session login is unavailable.",
                };
            }
            resolvedDisplayName = hosted.claims.displayName;
            normalized = normalizePlayerAccountName(resolvedDisplayName);
            if (!normalized) {
                return {
                    ok: false,
                    code: "invalid_name",
                    message: "Hosted session displayName is invalid.",
                };
            }
            hostedWorldCharacterId = hosted.claims.worldCharacterId;
        } else {
            const authResult: AccountAuthResult = this.deps.accountStore.verifyOrRegister(
                normalized!,
                request.password!,
            );
            switch (authResult.kind) {
                case "wrong_password":
                    return {
                        ok: false,
                        code: "wrong_password",
                        message: "Invalid username or password.",
                    };
                case "banned":
                    return {
                        ok: false,
                        code: "banned",
                        message: authResult.reason
                            ? `Account banned: ${authResult.reason}`
                            : "Account banned.",
                    };
                case "password_too_short":
                    return {
                        ok: false,
                        code: "password_too_short",
                        message: `Password must be at least ${authResult.minLength} characters.`,
                    };
                case "error":
                    logger.warn("[agent] account store error", authResult.error);
                    return {
                        ok: false,
                        code: "auth_error",
                        message: "Account store error; try again.",
                    };
                case "ok":
                    created = authResult.created;
                    break;
            }
        }

        // 2. Name collision — covers humans AND bots (agents).
        if (players.hasConnectedPlayer(normalized!)) {
            return {
                ok: false,
                code: "name_taken",
                message: `"${normalized}" is already logged in.`,
            };
        }

        const finalDisplayName = normalized!;

        // 3. Create the headless entity at the gamemode default spawn.
        //    If persisted state exists, applyToPlayer will overwrite the
        //    position with the last-saved tile, so the "spawn location" is
        //    only used for brand-new accounts.
        const spawn = this.deps.gamemode.getSpawnLocation(
            undefined as unknown as PlayerState,
        );
        const player = players.addBot(spawn.x, spawn.y, spawn.level);
        if (!player) {
            return {
                ok: false,
                code: "capacity_full",
                message: "Player id pool exhausted; cannot spawn more players.",
            };
        }

        player.name = finalDisplayName;

        // 4. Load persisted state (skills, inventory, bank, equipment,
        //    position, appearance, …). Mirrors LoginHandshakeService's
        //    handshake path so agents and humans share exactly one save
        //    format.
        const saveKey = buildScopedPlayerSaveKey({
            worldId: this.deps.worldId,
            name: finalDisplayName,
            id: player.id,
            worldCharacterId: hostedWorldCharacterId,
        });
        player.__saveKey = saveKey;
        try {
            this.deps.playerPersistence.applyToPlayer(player, saveKey);
        } catch (err) {
            logger.warn("[agent] failed to apply persistent vars", err);
        }

        // Account stage — same logic the human handshake uses.
        const hadPriorSave = this.deps.playerPersistence.hasKey(saveKey);
        try {
            if (!hadPriorSave) {
                player.account.accountStage = 0;
            } else if (!Number.isFinite(player.account.accountStage)) {
                player.account.accountStage = 1;
            }
        } catch {
            if (!Number.isFinite(player.account.accountStage)) {
                player.account.accountStage = 1;
            }
        }

        // 5. Attach the agent component — this is the wedge that the rest
        //    of the agent layer checks to decide "is this a bot or a
        //    first-class agent?"
        const component: AgentComponent = {
            identity: {
                agentId: request.agentId,
                displayName: finalDisplayName,
                controller: request.controller,
                persona: request.persona,
                createdAt: Date.now(),
            },
            actionQueue: new AgentActionQueue(),
            connected: true,
            lastHeardFrom: Date.now(),
            lastEmittedAt: 0,
        };
        player.agent = component;

        logger.info(
            `[agent] spawned agent id=${request.agentId} name="${finalDisplayName}" playerId=${player.id} world=${this.deps.worldId} hosted=${hostedTokenMode}`,
        );

        return { ok: true, player, created, saveKey };
    }

    /**
     * Mark an agent as disconnected. The {@link PlayerState} stays in the
     * world so other players can see it until the bot-SDK server reaps it
     * during close; the persistence snapshot is also taken at that time.
     */
    markDisconnected(player: PlayerState): void {
        if (!player.agent) return;
        player.agent.connected = false;
        player.agent.lastHeardFrom = Date.now();
    }

    /**
     * Fully reap an agent player from the world. Called by BotSdkServer
     * after the persistence snapshot has been flushed; removes the
     * PlayerState from the manager's bots list, frees the player id, and
     * drops all interaction state so the name is immediately available
     * for a subsequent login.
     */
    destroy(player: PlayerState): void {
        const players = this.deps.players();
        if (!players) return;
        players.removeBot(player);
    }
}
