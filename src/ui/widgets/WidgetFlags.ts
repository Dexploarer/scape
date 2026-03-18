/**
 * OSRS Widget Flags - Centralized flag bit definitions
 *
 * Widget flags are stored as a 24-bit integer (Medium in cache format).
 * The server sends IF_SETEVENTS packets to override cache-defined flags at runtime.
 *
 * OSRS Flag Storage Key (class405.getWidgetFlags):
 * - Key = (widget.childIndex) + (widget.id << 32)
 * - Static widgets (from cache): childIndex = -1, id = widget's UID
 * - Dynamic children (CC_CREATE): childIndex = slot index (>= 0), id = parent's UID
 *
 * IF_SETEVENTS fromSlot/toSlot:
 * - For static widgets: fromSlot = -1, toSlot = -1
 * - For dynamic children: fromSlot = 0, toSlot = N-1 (or whatever range)
 *
 * Reference: RuneLite WidgetConfig.java, class405.getWidgetFlags, class304.method5978,
 *            Widget.java constructor (childIndex = -1), class28.java CC_CREATE
 */

// ============================================================================
// Flag Bit Positions
// ============================================================================

/**
 * Bit 0: Pause button / clickable widget
 * Enables "Continue" menu option for dialog widgets.
 * Reference: class304.method5978 - (flags & 1) != 0
 */
export const FLAG_PAUSE_BUTTON = 1 << 0;

/**
 * Bits 1-10: Transmit action flags
 * When action N (0-indexed) is clicked, check bit (N+1) to determine if it
 * should be transmitted to the server. If not set, only run CS2 handler.
 * OSRS supports 10 ops total (indices 0-9, bits 1-10).
 * Reference: HealthBarUpdate.java:229, class59.java:733, WorldMapSprite.java:109-124
 */
export const FLAG_TRANSMIT_OP1 = 1 << 1;
export const FLAG_TRANSMIT_OP2 = 1 << 2;
export const FLAG_TRANSMIT_OP3 = 1 << 3;
export const FLAG_TRANSMIT_OP4 = 1 << 4;
export const FLAG_TRANSMIT_OP5 = 1 << 5;
export const FLAG_TRANSMIT_OP6 = 1 << 6;
export const FLAG_TRANSMIT_OP7 = 1 << 7;
export const FLAG_TRANSMIT_OP8 = 1 << 8;
export const FLAG_TRANSMIT_OP9 = 1 << 9;
export const FLAG_TRANSMIT_OP10 = 1 << 10;

/**
 * Bits 11-16: Target mask (6 bits)
 * Indicates what entity types this widget can target when in targeting mode.
 * Reference: class155.Widget_unpackTargetMask - (flags >> 11) & 63
 */
export const FLAG_USE_GROUND_ITEM = 1 << 11; // Can target ground items
export const FLAG_USE_NPC = 1 << 12; // Can target NPCs
export const FLAG_USE_OBJECT = 1 << 13; // Can target game objects (locs)
export const FLAG_USE_PLAYER = 1 << 14; // Can target players
export const FLAG_USE_ITEM = 1 << 15; // Can target inventory items (deprecated)
export const FLAG_USE_WIDGET = 1 << 16; // Can target widgets with WIDGET_USE_TARGET

export const TARGET_MASK_SHIFT = 11;
export const TARGET_MASK_BITS = 0x3f; // 6 bits

/**
 * Bits 17-19: Drag parent depth (3-bit field, NOT a boolean flag)
 * Value 0-7 indicating the number of parent levels to climb for drag operations.
 * Use getDragDepth(flags) to extract this value.
 * Reference: ReflectionCheck.method736 - (flags >> 17) & 7
 *
 * NOTE: This is a multi-bit field, not a single flag. There is no "FLAG_DRAG".
 * The drag capability is controlled by bit 20 (FLAG_DRAG_ON).
 */
export const DRAG_DEPTH_SHIFT = 17;
export const DRAG_DEPTH_BITS = 0x7; // 3 bits (values 0-7)

/**
 * Bit 20: Drop target (DRAG_ON)
 * Widget can receive drag-and-drop items.
 * Reference: Skeleton.method5378 - (flags >> 20 & 1) != 0
 */
export const FLAG_DRAG_ON = 1 << 20;

/**
 * Bit 21: Widget use target
 * Widget can be targeted by spells/items using USE_WIDGET flag.
 * Reference: WorldMapSprite.java:104 - (flags >> 21 & 1) != 0
 */
export const FLAG_WIDGET_USE_TARGET = 1 << 21;

/**
 * Bit 22: Key input enabled
 * Related to keyboard input handling for widgets.
 * Reference: ModeWhere.method7296 - (flags >> 22 & 1) != 0
 */
export const FLAG_KEY_INPUT = 1 << 22;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if pause button flag is set (bit 0).
 * Reference: class304.method5978
 */
export function isPauseButton(flags: number): boolean {
    return (flags & FLAG_PAUSE_BUTTON) !== 0;
}

/**
 * Get the transmit flag bit for a given action index (0-indexed).
 * Returns the bit value (1 << (actionIndex + 1)).
 * OSRS supports action indices 0-9 (10 ops total).
 * Reference: WidgetConfig.transmitAction
 */
export function getTransmitActionBit(actionIndex: number): number {
    if (actionIndex < 0 || actionIndex > 9) return 0;
    return 1 << (actionIndex + 1);
}

/**
 * Check if action at given index (0-indexed) should be transmitted to server.
 * OSRS supports action indices 0-9 (10 ops total).
 * Reference: HealthBarUpdate.java:229 - (flags >> (actionIndex + 1) & 1) != 0
 */
export function shouldTransmitAction(flags: number, actionIndex: number): boolean {
    if (actionIndex < 0 || actionIndex > 9) return false;
    return ((flags >> (actionIndex + 1)) & 1) !== 0;
}

/**
 * Check if menu option at given index should be displayed.
 * In OSRS, a menu option is shown if:
 * 1. The transmit flag for that action is set, OR
 * 2. The widget has an onOp handler
 *
 * Reference: HealthBarUpdate.java method2496
 */
export function shouldShowMenuOption(
    flags: number,
    actionIndex: number,
    hasOnOpHandler: boolean,
): boolean {
    const transmitSet = shouldTransmitAction(flags, actionIndex);
    return transmitSet || hasOnOpHandler;
}

/**
 * Extract target mask from flags (bits 11-16).
 * Reference: class155.Widget_unpackTargetMask
 */
export function getTargetMask(flags: number): number {
    return (flags >> TARGET_MASK_SHIFT) & TARGET_MASK_BITS;
}

/**
 * Normalize target flags to the 6-bit unpacked mask used by OSRS selectedSpellFlags.
 *
 * Accepts either:
 * - packed widget flags (bits 11-16), or
 * - an already-unpacked 0..63 target mask.
 */
function normalizeTargetMask(flagsOrMask: number): number {
    const value = flagsOrMask | 0;
    if ((value & ~TARGET_MASK_BITS) === 0) {
        return value & TARGET_MASK_BITS;
    }
    return getTargetMask(value);
}

const MASK_USE_GROUND_ITEM = FLAG_USE_GROUND_ITEM >> TARGET_MASK_SHIFT; // 0x1
const MASK_USE_NPC = FLAG_USE_NPC >> TARGET_MASK_SHIFT; // 0x2
const MASK_USE_OBJECT = FLAG_USE_OBJECT >> TARGET_MASK_SHIFT; // 0x4
const MASK_USE_PLAYER = FLAG_USE_PLAYER >> TARGET_MASK_SHIFT; // 0x8
const MASK_USE_WIDGET = FLAG_USE_WIDGET >> TARGET_MASK_SHIFT; // 0x20

/**
 * Check if widget can target ground items.
 */
export function canTargetGroundItem(flagsOrMask: number): boolean {
    const mask = normalizeTargetMask(flagsOrMask);
    return (mask & MASK_USE_GROUND_ITEM) !== 0;
}

/**
 * Check if widget can target NPCs.
 */
export function canTargetNpc(flagsOrMask: number): boolean {
    const mask = normalizeTargetMask(flagsOrMask);
    return (mask & MASK_USE_NPC) !== 0;
}

/**
 * Check if widget can target game objects (locs).
 */
export function canTargetObject(flagsOrMask: number): boolean {
    const mask = normalizeTargetMask(flagsOrMask);
    return (mask & MASK_USE_OBJECT) !== 0;
}

/**
 * Check if widget can target players.
 */
export function canTargetPlayer(flagsOrMask: number): boolean {
    const mask = normalizeTargetMask(flagsOrMask);
    return (mask & MASK_USE_PLAYER) !== 0;
}

/**
 * Check if widget can target other widgets.
 */
export function canTargetWidget(flagsOrMask: number): boolean {
    const mask = normalizeTargetMask(flagsOrMask);
    return (mask & MASK_USE_WIDGET) !== 0;
}

/**
 * Extract drag parent depth from flags (bits 17-19).
 * Reference: ReflectionCheck.method736
 */
export function getDragDepth(flags: number): number {
    return (flags >> DRAG_DEPTH_SHIFT) & DRAG_DEPTH_BITS;
}

/**
 * Check if widget can be a drop target (bit 20).
 * Reference: Skeleton.method5378
 */
export function isDropTarget(flags: number): boolean {
    return ((flags >> 20) & 1) !== 0;
}

/**
 * Check if widget can be targeted by USE_WIDGET (bit 21).
 * Reference: WorldMapSprite.java:104
 */
export function isWidgetUseTarget(flags: number): boolean {
    return ((flags >> 21) & 1) !== 0;
}

/**
 * Check if key input flag is set (bit 22).
 * Reference: ModeWhere.method7296
 */
export function hasKeyInputFlag(flags: number): boolean {
    return ((flags >> 22) & 1) !== 0;
}

/**
 * Build a flags value with the given transmit actions enabled.
 * @param transmitActions Array of action indices (0-9) to enable transmission for
 */
export function buildTransmitFlags(...transmitActions: number[]): number {
    let flags = 0;
    for (const action of transmitActions) {
        if (action >= 0 && action <= 9) {
            flags |= 1 << (action + 1);
        }
    }
    return flags;
}

/**
 * Build flags for setInterfaceEvents with common configurations.
 */
export function buildWidgetFlags(options: {
    pauseButton?: boolean;
    transmitActions?: number[];
    targetMask?: number;
    dragDepth?: number;
    dropTarget?: boolean;
    widgetUseTarget?: boolean;
    keyInput?: boolean;
}): number {
    let flags = 0;

    if (options.pauseButton) {
        flags |= FLAG_PAUSE_BUTTON;
    }

    if (options.transmitActions) {
        for (const action of options.transmitActions) {
            if (action >= 0 && action <= 9) {
                flags |= 1 << (action + 1);
            }
        }
    }

    if (options.targetMask !== undefined) {
        flags |= (options.targetMask & TARGET_MASK_BITS) << TARGET_MASK_SHIFT;
    }

    if (options.dragDepth !== undefined) {
        flags |= (options.dragDepth & DRAG_DEPTH_BITS) << DRAG_DEPTH_SHIFT;
    }

    if (options.dropTarget) {
        flags |= FLAG_DRAG_ON;
    }

    if (options.widgetUseTarget) {
        flags |= FLAG_WIDGET_USE_TARGET;
    }

    if (options.keyInput) {
        flags |= FLAG_KEY_INPUT;
    }

    return flags;
}
