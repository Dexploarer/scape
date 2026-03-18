/**
 * Priority levels for queue tasks.
 * RSMod parity: gg.rsmod.game.model.queue.TaskPriority
 */
export enum TaskPriority {
    /**
     * Weak tasks can be interrupted by player input (walking, attacking).
     * Used for skilling actions, following, etc.
     */
    WEAK = 0,

    /**
     * A standard priority task will wait if you have a menu open,
     * and execute when said menu closes.
     */
    STANDARD = 1,

    /**
     * Strong tasks can interrupt normal and weak tasks.
     * Used for important actions like teleporting.
     */
    STRONG = 2,
}
