import { TimerKey, timerKey } from "./TimerKey";

/**
 * Standard timer keys used throughout the game.
 * RSMod parity: gg.rsmod.game.model.timer.Timers
 */

/**
 * Internal timer used to reset pawn facing after a set amount of time.
 */
export const RESET_PAWN_FACING_TIMER: TimerKey = timerKey();

/**
 * Timer for skull icon duration (PKing).
 */
export const SKULL_ICON_DURATION_TIMER: TimerKey = timerKey();

/**
 * Timer that tracks if a player was recently attacked.
 * Set to 17 ticks (10.2 seconds) when the player is attacked in PvP or PvM.
 * Prevents logging out, affects NPC aggro, etc.
 */
export const ACTIVE_COMBAT_TIMER: TimerKey = timerKey();
export const ACTIVE_COMBAT_TIMER_TICKS = 17;

/**
 * Timer used to force player disconnection (e.g., after death animation).
 */
export const FORCE_DISCONNECTION_TIMER: TimerKey = timerKey();

/**
 * Timer for freeze effects (Ice Barrage, Entangle, etc.).
 * Prevents movement while active.
 */
export const FROZEN_TIMER: TimerKey = timerKey(null, true, true);

/**
 * Timer for stun effects (Dragon spear, Zamorak Godsword, etc.).
 * Prevents all actions while active.
 */
export const STUN_TIMER: TimerKey = timerKey(null, true, true);

/**
 * Timer for poison damage ticks.
 */
export const POISON_TIMER: TimerKey = timerKey();

/**
 * Timer for venom damage ticks.
 */
export const VENOM_TIMER: TimerKey = timerKey();

/**
 * Timer for antifire potion effect.
 */
export const ANTIFIRE_TIMER: TimerKey = timerKey("antifire", false);

/**
 * Timer for super antifire potion effect.
 */
export const SUPER_ANTIFIRE_TIMER: TimerKey = timerKey("super_antifire", false);

/**
 * Timer for attack delay (weapon cooldown).
 * Set after each attack based on weapon speed.
 */
export const ATTACK_DELAY: TimerKey = timerKey();

/**
 * Timer for potion drinking delay (3 ticks).
 */
export const POTION_DELAY: TimerKey = timerKey();

/**
 * Timer for food eating delay (3 ticks).
 */
export const FOOD_DELAY: TimerKey = timerKey();

/**
 * Timer for combo food delay (Karambwan, etc.).
 * Separate from FOOD_DELAY to allow eating both.
 */
export const COMBO_FOOD_DELAY: TimerKey = timerKey();

/**
 * Timer for stamina potion effect.
 */
export const STAMINA_TIMER: TimerKey = timerKey("stamina", false);

/**
 * Timer for run energy drain.
 */
export const RUN_DRAIN_TIMER: TimerKey = timerKey();

/**
 * Timer for prayer point drain.
 */
export const PRAYER_DRAIN_TIMER: TimerKey = timerKey();

/**
 * Timer for hitpoint regeneration.
 */
export const HP_REGEN_TIMER: TimerKey = timerKey();

/**
 * Timer for special attack energy regeneration.
 */
export const SPECIAL_REGEN_TIMER: TimerKey = timerKey();

/**
 * Timer for stat restoration (boosts/drains returning to base).
 */
export const STAT_RESTORE_TIMER: TimerKey = timerKey();

/**
 * Timer for stat boost decay.
 */
export const STAT_BOOST_DECAY_TIMER: TimerKey = timerKey();

/**
 * Timer for teleblock effect.
 */
export const TELEBLOCK_TIMER: TimerKey = timerKey("teleblock", false, true);

/**
 * Timer for home teleport cooldown.
 */
export const HOME_TELEPORT_TIMER: TimerKey = timerKey("home_teleport", true);

/**
 * Timer for NPC aggro check interval.
 */
export const AGGRO_CHECK_TIMER: TimerKey = timerKey();

/**
 * Timer for NPC random walk interval.
 */
export const NPC_RANDOM_WALK_TIMER: TimerKey = timerKey();

/**
 * Timer for immunity after being hit (PvP).
 */
export const PJ_TIMER: TimerKey = timerKey();

/**
 * Timer for overload potion effect.
 */
export const OVERLOAD_TIMER: TimerKey = timerKey("overload", false);

/**
 * Timer for divine potion effect.
 */
export const DIVINE_POTION_TIMER: TimerKey = timerKey("divine_potion", false);

/**
 * Timer for imbued heart cooldown.
 */
export const IMBUED_HEART_TIMER: TimerKey = timerKey("imbued_heart", true);

/**
 * Timer for vengeance cooldown.
 */
export const VENGEANCE_TIMER: TimerKey = timerKey();

/**
 * Timer for vengeance active effect.
 */
export const VENGEANCE_ACTIVE_TIMER: TimerKey = timerKey();

// Re-export for convenience
export { TimerKey, timerKey } from "./TimerKey";
export { TimerMap, PersistentTimer } from "./TimerMap";
