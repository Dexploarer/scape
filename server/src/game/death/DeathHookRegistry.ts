/**
 * Death Hook Registry
 *
 * Manages pre-death and post-death hooks for extensible death handling.
 * Pre-death hooks can cancel death (e.g., Ring of Life, Phoenix necklace).
 * Post-death hooks run after respawn for cleanup/notifications.
 *
 * Security:
 * - 3 second timeout prevents infinite hangs
 * - Error isolation prevents hooks from breaking death flow
 * - Hooks run in priority order (higher = first)
 */
import {
    type DeathContext,
    type DeathHookResult,
    type PostDeathHook,
    type PreDeathHook,
} from "./types";

/** Maximum time to wait for a hook to execute (ms) */
const HOOK_TIMEOUT_MS = 3000;

/** Default result if hook times out or errors */
const DEFAULT_HOOK_RESULT: DeathHookResult = {
    cancelDeath: false,
    message: undefined,
    consumeItem: false,
};

export class DeathHookRegistry {
    private preDeathHooks: Map<string, PreDeathHook> = new Map();
    private postDeathHooks: Map<string, PostDeathHook> = new Map();
    private readonly log?: (level: "info" | "warn" | "error", message: string) => void;

    constructor(options?: { log?: (level: "info" | "warn" | "error", message: string) => void }) {
        this.log = options?.log;
    }

    /**
     * Register a pre-death hook.
     * @throws If a hook with the same ID is already registered
     */
    registerPreDeathHook(hook: PreDeathHook): void {
        if (this.preDeathHooks.has(hook.id)) {
            throw new Error(`Pre-death hook with ID "${hook.id}" is already registered`);
        }
        this.preDeathHooks.set(hook.id, hook);
        this.log?.("info", `Registered pre-death hook: ${hook.id}`);
    }

    /**
     * Register a post-death hook.
     * @throws If a hook with the same ID is already registered
     */
    registerPostDeathHook(hook: PostDeathHook): void {
        if (this.postDeathHooks.has(hook.id)) {
            throw new Error(`Post-death hook with ID "${hook.id}" is already registered`);
        }
        this.postDeathHooks.set(hook.id, hook);
        this.log?.("info", `Registered post-death hook: ${hook.id}`);
    }

    /**
     * Unregister a pre-death hook by ID.
     * @returns true if hook was found and removed
     */
    unregisterPreDeathHook(hookId: string): boolean {
        const removed = this.preDeathHooks.delete(hookId);
        if (removed) {
            this.log?.("info", `Unregistered pre-death hook: ${hookId}`);
        }
        return removed;
    }

    /**
     * Unregister a post-death hook by ID.
     * @returns true if hook was found and removed
     */
    unregisterPostDeathHook(hookId: string): boolean {
        const removed = this.postDeathHooks.delete(hookId);
        if (removed) {
            this.log?.("info", `Unregistered post-death hook: ${hookId}`);
        }
        return removed;
    }

    /**
     * Execute all applicable pre-death hooks in priority order.
     * Stops early if any hook cancels the death.
     *
     * @returns Combined result from hooks
     */
    async executePreDeathHooks(context: DeathContext): Promise<DeathHookResult> {
        const hooks = this.getSortedPreDeathHooks();

        for (const hook of hooks) {
            // Check if hook should execute
            let shouldExecute = false;
            try {
                shouldExecute = hook.shouldExecute(context);
            } catch (error) {
                this.log?.("error", `Pre-death hook "${hook.id}" shouldExecute threw: ${error}`);
                continue;
            }

            if (!shouldExecute) continue;

            // Execute hook with timeout
            const result = await this.executeHookWithTimeout(hook.id, () => hook.execute(context));

            // If hook cancels death, return immediately
            if (result.cancelDeath) {
                this.log?.("info", `Pre-death hook "${hook.id}" cancelled death`);
                return result;
            }
        }

        return DEFAULT_HOOK_RESULT;
    }

    /**
     * Execute all post-death hooks in priority order.
     * All hooks run regardless of individual failures.
     */
    async executePostDeathHooks(context: DeathContext): Promise<void> {
        const hooks = this.getSortedPostDeathHooks();

        for (const hook of hooks) {
            try {
                await this.executeHookWithTimeout(hook.id, async () => {
                    await hook.execute(context);
                    return DEFAULT_HOOK_RESULT;
                });
            } catch (error) {
                // Log but continue with other hooks
                this.log?.("error", `Post-death hook "${hook.id}" failed: ${error}`);
            }
        }
    }

    /**
     * Execute a hook function with timeout protection.
     */
    private async executeHookWithTimeout(
        hookId: string,
        fn: () => Promise<DeathHookResult> | DeathHookResult,
    ): Promise<DeathHookResult> {
        return new Promise<DeathHookResult>((resolve) => {
            const timeoutId = setTimeout(() => {
                this.log?.("warn", `Hook "${hookId}" timed out after ${HOOK_TIMEOUT_MS}ms`);
                resolve(DEFAULT_HOOK_RESULT);
            }, HOOK_TIMEOUT_MS);

            try {
                const result = fn();
                if (result instanceof Promise) {
                    result
                        .then((res) => {
                            clearTimeout(timeoutId);
                            resolve(res);
                        })
                        .catch((error) => {
                            clearTimeout(timeoutId);
                            this.log?.("error", `Hook "${hookId}" threw: ${error}`);
                            resolve(DEFAULT_HOOK_RESULT);
                        });
                } else {
                    clearTimeout(timeoutId);
                    resolve(result);
                }
            } catch (error) {
                clearTimeout(timeoutId);
                this.log?.("error", `Hook "${hookId}" threw synchronously: ${error}`);
                resolve(DEFAULT_HOOK_RESULT);
            }
        });
    }

    /**
     * Get pre-death hooks sorted by priority (descending).
     */
    private getSortedPreDeathHooks(): PreDeathHook[] {
        return Array.from(this.preDeathHooks.values()).sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get post-death hooks sorted by priority (descending).
     */
    private getSortedPostDeathHooks(): PostDeathHook[] {
        return Array.from(this.postDeathHooks.values()).sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get registered hook IDs for debugging.
     */
    getRegisteredHookIds(): { preDeathHooks: string[]; postDeathHooks: string[] } {
        return {
            preDeathHooks: Array.from(this.preDeathHooks.keys()),
            postDeathHooks: Array.from(this.postDeathHooks.keys()),
        };
    }

    /**
     * Clear all registered hooks.
     */
    clear(): void {
        this.preDeathHooks.clear();
        this.postDeathHooks.clear();
        this.log?.("info", "Cleared all death hooks");
    }
}

/**
 * Create a Ring of Life pre-death hook.
 * Teleports player if HP is 10% or below (on hit, not on death).
 * Note: In real OSRS this triggers on damage, not on death.
 */
export function createRingOfLifeHook(): PreDeathHook {
    const RING_OF_LIFE_ID = 2570;

    return {
        id: "ring_of_life",
        priority: 100, // High priority - should run early
        shouldExecute: (context) => {
            // Check if player has Ring of Life equipped
            const equipment = context.player.exportEquipmentSnapshot();
            const hasRing = equipment.some(
                (e) => e.slot === 12 && e.itemId === RING_OF_LIFE_ID, // Ring slot
            );
            // Only works outside wilderness
            return hasRing && context.wildernessLevel === 0;
        },
        execute: (context) => {
            // Ring of Life would teleport player to spawn
            // This is a simplified version - real implementation would
            // consume the ring and teleport the player
            return {
                cancelDeath: true,
                message: "Your Ring of Life saves you!",
                consumeItem: true,
            };
        },
    };
}

/**
 * Create a Phoenix necklace pre-death hook.
 * Restores 30% HP when player would die.
 */
export function createPhoenixNecklaceHook(): PreDeathHook {
    const PHOENIX_NECKLACE_ID = 11090;

    return {
        id: "phoenix_necklace",
        priority: 90, // Below Ring of Life
        shouldExecute: (context) => {
            // Check if player has Phoenix necklace equipped
            const equipment = context.player.exportEquipmentSnapshot();
            return equipment.some(
                (e) => e.slot === 2 && e.itemId === PHOENIX_NECKLACE_ID, // Amulet slot
            );
        },
        execute: (context) => {
            // Phoenix necklace would restore HP and break
            // This is a simplified version
            return {
                cancelDeath: true,
                message: "Your Phoenix necklace heals you!",
                consumeItem: true,
            };
        },
    };
}
