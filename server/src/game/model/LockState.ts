/**
 * A LockState represents a state that prevents or allows certain actions.
 * RSMod parity: gg.rsmod.game.model.LockState
 */
export enum LockState {
    /**
     * Can freely move around, read and write messages.
     */
    NONE = "none",

    /**
     * Delays actions such as turning prayers on and being damaged.
     * Used during teleports.
     */
    DELAY_ACTIONS = "delay_actions",

    /**
     * Similar to FULL, but can interact with items.
     */
    FULL_WITH_ITEM_INTERACTION = "full_with_item_interaction",

    /**
     * Similar to FULL, but removes and gives immunity to damage.
     * Used during cutscenes.
     */
    FULL_WITH_DAMAGE_IMMUNITY = "full_with_damage_immunity",

    /**
     * Similar to FULL, but can log out.
     */
    FULL_WITH_LOGOUT = "full_with_logout",

    /**
     * Cannot log out or perform various actions.
     */
    FULL = "full",
}

/**
 * Helper functions for LockState checks.
 * RSMod parity: Extension methods on LockState enum.
 */
export const LockStateChecks = {
    canLogout(state: LockState): boolean {
        switch (state) {
            case LockState.NONE:
            case LockState.FULL_WITH_LOGOUT:
                return true;
            default:
                return false;
        }
    },

    canMove(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canAttack(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canBeAttacked(state: LockState): boolean {
        return state !== LockState.FULL_WITH_DAMAGE_IMMUNITY;
    },

    canDropItems(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canGroundItemInteract(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canNpcInteract(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canPlayerInteract(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canItemInteract(state: LockState): boolean {
        switch (state) {
            case LockState.NONE:
            case LockState.FULL_WITH_ITEM_INTERACTION:
                return true;
            default:
                return false;
        }
    },

    canInterfaceInteract(state: LockState): boolean {
        return state === LockState.NONE;
    },

    canUsePrayer(state: LockState): boolean {
        switch (state) {
            case LockState.NONE:
            case LockState.DELAY_ACTIONS:
                return true;
            default:
                return false;
        }
    },

    canRestoreRunEnergy(state: LockState): boolean {
        return state !== LockState.DELAY_ACTIONS;
    },

    delaysPrayer(state: LockState): boolean {
        return state === LockState.DELAY_ACTIONS;
    },

    delaysDamage(state: LockState): boolean {
        return state === LockState.DELAY_ACTIONS;
    },

    canTeleport(state: LockState): boolean {
        return state === LockState.NONE;
    },
};
