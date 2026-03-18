/**
 * WorldMenuBuilder - Extracts pure menu entry building logic from WebGLOsrsRenderer.
 *
 * This module builds OsrsMenuEntry arrays for world interactions (LOCs, OBJs, NPCs, Players).
 * The actual interaction checking and click handling remains in the renderer since it needs
 * GPU access (interaction buffer) and input state.
 *
 * OSRS Parity: Menu construction follows the same priority and structure as the Java client.
 */
import {
    type MenuEntry,
    MenuTargetType,
    OsrsMenuEntry,
    SpellCastMetadata,
} from "../../rs/MenuEntry";
import type { LocType } from "../../rs/config/loctype/LocType";
import type { NpcType } from "../../rs/config/npctype/NpcType";
import type { ObjType } from "../../rs/config/objtype/ObjType";
import {
    canTargetGroundItem,
    canTargetNpc,
    canTargetObject,
    canTargetPlayer,
} from "../../ui/widgets/WidgetFlags";

/**
 * Active spell state for menu building
 */
export interface ActiveSpellState {
    spellId: number;
    actionName: string;
    spellName: string;
    spellLevel: number;
    runes: Array<{ itemId: number; quantity: number }> | null;
    targetMask: number; // Spell target flags (which entity types can be targeted)
}

/**
 * Selected inventory item state for menu building
 */
export interface SelectedItemState {
    itemId: number;
    itemName: string;
    slot: number;
}

/**
 * Context needed for building menu entries
 */
export interface MenuBuildContext {
    activeSpell: ActiveSpellState | null;
    selectedItem: SelectedItemState | null;
    debugId: boolean;
    npcAttackOption: number; // 0=depends on level, 1=always right-click, 2=left-click, 3=hidden
    localPlayerCombatLevel: number;
    followerOpsLowPriority: boolean; // When true, all options on follower NPCs are deprioritized
    followerIndex?: number; // Active follower NPC server index; follower menus are gated to this NPC only
}

/**
 * Callbacks for menu entry actions - keeps menu builder pure
 */
export interface MenuActionCallbacks {
    onExamine: (entry: OsrsMenuEntry) => void;
    onUseItemOn: (
        entry: OsrsMenuEntry,
        context: { mapX?: number; mapY?: number; playerServerId?: number },
    ) => void;
    onTakeGroundItem: (stack: any) => void;
    onExamineGroundItem: (stack: any) => void;
    onAttackNpc: (params: {
        npcTypeId: number;
        mapX: number;
        mapY: number;
        tile?: { tileX: number; tileY: number };
    }) => void;
    onInteractNpc: (params: {
        npcTypeId: number;
        option: string;
        mapX: number;
        mapY: number;
        tile?: { tileX: number; tileY: number };
    }) => void;
    onFollowPlayer: (serverId: number) => void;
    onTradePlayer: (serverId: number) => void;
    closeMenu: () => void;
}

const EMPTY_MENU_ENTRY: OsrsMenuEntry = {
    option: "",
    targetId: -1,
    targetType: MenuTargetType.NONE,
    targetName: "",
    targetLevel: -1,
};

function ensureMenuEntry(entry: MenuEntry | undefined): OsrsMenuEntry {
    return entry ? entry : EMPTY_MENU_ENTRY;
}

/**
 * Build menu entries for a LOC (location/object in world)
 */
export function buildLocMenuEntries(
    locType: LocType,
    mapX: number,
    mapY: number,
    ctx: MenuBuildContext,
    callbacks: MenuActionCallbacks,
): { actions: OsrsMenuEntry[]; examine: OsrsMenuEntry | null } {
    const actions: OsrsMenuEntry[] = [];

    if (locType.name === "null" && !ctx.debugId) {
        return { actions: [], examine: null };
    }

    // Cast spell on LOC - only if spell can target objects
    if (ctx.activeSpell && canTargetObject(ctx.activeSpell.targetMask)) {
        actions.push({
            option: ctx.activeSpell.actionName || "Cast",
            targetId: locType.id,
            targetType: MenuTargetType.LOC,
            targetName: `${ctx.activeSpell.spellName} -> ${locType.name}`,
            targetLevel: -1,
            mapX,
            mapY,
            spellCast: {
                spellId: ctx.activeSpell.spellId,
                spellName: ctx.activeSpell.spellName,
                spellLevel: ctx.activeSpell.spellLevel,
                runes: ctx.activeSpell.runes ? ctx.activeSpell.runes : undefined,
                mapX,
                mapY,
            },
        });
    }

    // Use item on LOC
    if (ctx.selectedItem) {
        actions.push({
            option: "Use",
            targetId: locType.id,
            targetType: MenuTargetType.LOC,
            targetName: `${ctx.selectedItem.itemName} -> ${locType.name}`,
            targetLevel: -1,
            mapX,
            mapY,
            onClick: (entry?: MenuEntry) =>
                callbacks.onUseItemOn(ensureMenuEntry(entry), { mapX, mapY }),
        });
    }

    // LOC actions from definition
    for (let actionIdx = 0; actionIdx < locType.actions.length; actionIdx++) {
        const option = locType.actions[actionIdx];
        if (!option) continue;

        actions.push({
            option,
            targetId: locType.id,
            targetType: MenuTargetType.LOC,
            targetName: locType.name,
            targetLevel: -1,
            mapX,
            mapY,
            actionIndex: actionIdx,
        });
    }

    // OSRS: Don't show Examine when item is selected
    const examine: OsrsMenuEntry | null = ctx.selectedItem
        ? null
        : {
              option: "Examine",
              targetId: locType.id,
              targetType: MenuTargetType.LOC,
              targetName: locType.name,
              targetLevel: -1,
          };

    return { actions, examine };
}

/**
 * Build menu entries for a ground item (OBJ)
 */
export function buildGroundItemMenuEntries(
    objType: ObjType,
    stackId: number,
    stack: any,
    mapX: number,
    mapY: number,
    ctx: MenuBuildContext,
    callbacks: MenuActionCallbacks,
): { actions: OsrsMenuEntry[]; examine: OsrsMenuEntry | null } {
    const actions: OsrsMenuEntry[] = [];

    if (objType.name === "null" && !ctx.debugId) {
        return { actions: [], examine: null };
    }

    // Cast spell on ground item - only if spell can target ground items
    if (ctx.activeSpell && canTargetGroundItem(ctx.activeSpell.targetMask)) {
        actions.push({
            option: ctx.activeSpell.actionName || "Cast",
            targetId: objType.id,
            targetType: MenuTargetType.OBJ,
            targetName: `${ctx.activeSpell.spellName} -> ${objType.name}`,
            targetLevel: -1,
            mapX,
            mapY,
            spellCast: {
                spellId: ctx.activeSpell.spellId,
                spellName: ctx.activeSpell.spellName,
                spellLevel: ctx.activeSpell.spellLevel,
                runes: ctx.activeSpell.runes ? ctx.activeSpell.runes : undefined,
                mapX,
                mapY,
            },
        });
    }

    // Use item on ground item
    if (ctx.selectedItem) {
        actions.push({
            option: "Use",
            targetId: objType.id,
            targetType: MenuTargetType.OBJ,
            targetName: `${ctx.selectedItem.itemName} -> ${objType.name}`,
            targetLevel: -1,
            mapX,
            mapY,
            onClick: (entry?: MenuEntry) => callbacks.onUseItemOn(ensureMenuEntry(entry), {}),
        });
    }

    // Ground item actions from definition
    // OSRS: If action at index 2 is null, show "Take" as default (opcode 20)
    let hasTakeAction = false;
    for (let actionIdx = 0; actionIdx < objType.groundActions.length; actionIdx++) {
        const option = objType.groundActions[actionIdx];
        if (!option) continue;

        if (actionIdx === 2) hasTakeAction = true;

        const capturedStack = stack;
        actions.push({
            option,
            targetId: objType.id,
            targetType: MenuTargetType.OBJ,
            targetName: objType.name,
            targetLevel: -1,
            mapX,
            mapY,
            actionIndex: actionIdx,
            onClick: (entry?: MenuEntry) => {
                if (entry && option.toLowerCase() === "take") {
                    callbacks.onTakeGroundItem(capturedStack);
                } else {
                    callbacks.closeMenu();
                }
            },
        });
    }

    // OSRS: Default "Take" option if no action defined at index 2
    if (!hasTakeAction) {
        const capturedStack = stack;
        actions.push({
            option: "Take",
            targetId: objType.id,
            targetType: MenuTargetType.OBJ,
            targetName: objType.name,
            targetLevel: -1,
            mapX,
            mapY,
            actionIndex: 2, // OSRS uses opcode 20 which maps to actionIndex 2
            onClick: () => callbacks.onTakeGroundItem(capturedStack),
        });
    }

    // OSRS: Don't show Examine when item is selected
    const examine: OsrsMenuEntry | null = ctx.selectedItem
        ? null
        : {
              option: "Examine",
              targetId: objType.id,
              targetType: MenuTargetType.OBJ,
              targetName: objType.name,
              targetLevel: -1,
          };

    return { actions, examine };
}

/**
 * Build menu entries for an NPC
 */
export function buildNpcMenuEntries(
    npcType: NpcType,
    mapX: number,
    mapY: number,
    ctx: MenuBuildContext,
    callbacks: MenuActionCallbacks,
    getMenuTile: () => { tileX: number; tileY: number } | undefined,
    npcServerId?: number,
): { actions: OsrsMenuEntry[]; examine: OsrsMenuEntry | null } {
    const actions: OsrsMenuEntry[] = [];

    if (npcType.name === "null" && !ctx.debugId) {
        return { actions: [], examine: null };
    }

    if (
        npcType.isFollower &&
        npcServerId !== undefined &&
        (ctx.followerIndex ?? -1) !== (npcServerId | 0)
    ) {
        return { actions: [], examine: null };
    }

    const isFollowerLowPriority = npcType.isFollower && ctx.followerOpsLowPriority;

    // OSRS: When follower has low priority, Examine is added FIRST (appears at top of menu)
    // This ensures left-click doesn't trigger follower actions
    if (isFollowerLowPriority) {
        actions.push({
            option: "Examine",
            targetId: npcType.id,
            targetType: MenuTargetType.NPC,
            targetName: npcType.name,
            targetLevel: npcType.combatLevel,
            deprioritized: true, // Still deprioritized but at top
        });
    }

    // Cast spell on NPC - only if spell can target NPCs
    if (ctx.activeSpell && canTargetNpc(ctx.activeSpell.targetMask)) {
        actions.push({
            option: ctx.activeSpell.actionName || "Cast",
            targetId: npcType.id,
            targetType: MenuTargetType.NPC,
            targetName: `${ctx.activeSpell.spellName} -> ${npcType.name}`,
            targetLevel: npcType.combatLevel,
            mapX,
            mapY,
            spellCast: {
                spellId: ctx.activeSpell.spellId,
                spellName: ctx.activeSpell.spellName,
                spellLevel: ctx.activeSpell.spellLevel,
                runes: ctx.activeSpell.runes ? ctx.activeSpell.runes : undefined,
                mapX,
                mapY,
            },
        });
    }

    // Use item on NPC
    if (ctx.selectedItem) {
        actions.push({
            option: "Use",
            targetId: npcType.id,
            targetType: MenuTargetType.NPC,
            targetName: `${ctx.selectedItem.itemName} -> ${npcType.name}`,
            targetLevel: npcType.combatLevel,
            mapX,
            mapY,
            onClick: (entry?: MenuEntry) =>
                callbacks.onUseItemOn(ensureMenuEntry(entry), { mapX, mapY }),
        });
    }

    // NPC actions from definition
    for (let actionIdx = 0; actionIdx < npcType.actions.length; actionIdx++) {
        const option = npcType.actions[actionIdx];
        if (!option) continue;

        const isAttack = option.toLowerCase() === "attack";

        // OSRS Attack option handling
        // 0 = Depends on combat level, 1 = Always right-click, 2 = Left-click, 3 = Hidden
        if (isAttack && ctx.npcAttackOption === 3) {
            continue; // Hidden: don't show attack at all
        }

        // Check if attack should be deprioritized
        let deprioritized = false;
        if (isAttack) {
            if (ctx.npcAttackOption === 1) {
                // Always right-click: always deprioritize
                deprioritized = true;
            } else if (ctx.npcAttackOption === 0) {
                // Depends on combat level: deprioritize if NPC level > player level
                const npcLevel = typeof npcType.combatLevel === "number" ? npcType.combatLevel : 0;
                if (npcLevel > ctx.localPlayerCombatLevel) {
                    deprioritized = true;
                }
            }
            // npcAttackOption === 2: Left-click where available, never deprioritize
        }
        // Follower low priority: deprioritize ALL options on followers
        if (npcType.isFollower && ctx.followerOpsLowPriority) {
            deprioritized = true;
        }

        const onClick = isAttack
            ? () => {
                  const tile = getMenuTile();
                  callbacks.onAttackNpc({
                      npcTypeId: npcType.id | 0,
                      mapX: mapX | 0,
                      mapY: mapY | 0,
                      tile: tile ? { tileX: tile.tileX | 0, tileY: tile.tileY | 0 } : undefined,
                  });
                  callbacks.closeMenu();
              }
            : () => {
                  const tile = getMenuTile();
                  callbacks.onInteractNpc({
                      npcTypeId: npcType.id | 0,
                      option,
                      mapX: mapX | 0,
                      mapY: mapY | 0,
                      tile: tile ? { tileX: tile.tileX | 0, tileY: tile.tileY | 0 } : undefined,
                  });
                  callbacks.closeMenu();
              };

        actions.push({
            option,
            targetId: npcType.id,
            targetType: MenuTargetType.NPC,
            targetName: npcType.name,
            targetLevel: npcType.combatLevel,
            mapX,
            mapY,
            actionIndex: actionIdx,
            deprioritized,
            onClick,
        });
    }

    // OSRS: Don't show Examine if:
    // 1. Follower with low priority (already added at top)
    // 2. Item is selected (only show "Use" option)
    const examine: OsrsMenuEntry | null =
        isFollowerLowPriority || ctx.selectedItem
            ? null
            : {
                  option: "Examine",
                  targetId: npcType.id,
                  targetType: MenuTargetType.NPC,
                  targetName: npcType.name,
                  targetLevel: npcType.combatLevel,
              };

    return { actions, examine };
}

/**
 * Build menu entries for a Player
 */
export function buildPlayerMenuEntries(
    targetName: string,
    serverId: number,
    myServerId: number,
    ctx: MenuBuildContext,
    callbacks: MenuActionCallbacks,
): { actions: OsrsMenuEntry[] } {
    const actions: OsrsMenuEntry[] = [];

    // Don't show menu for self
    if (serverId === myServerId) {
        return { actions };
    }

    // Cast spell on player - only if spell can target players
    if (ctx.activeSpell && canTargetPlayer(ctx.activeSpell.targetMask)) {
        actions.push({
            option: ctx.activeSpell.actionName || "Cast",
            targetId: -1,
            targetType: MenuTargetType.PLAYER,
            targetName: `${ctx.activeSpell.spellName} -> ${targetName}`,
            targetLevel: -1,
            spellCast: {
                spellId: ctx.activeSpell.spellId,
                spellName: ctx.activeSpell.spellName,
                spellLevel: ctx.activeSpell.spellLevel,
                runes: ctx.activeSpell.runes ? ctx.activeSpell.runes : undefined,
                playerServerId: serverId | 0,
            },
        });
    }

    // Follow player
    actions.push({
        option: "Follow",
        targetId: serverId,
        targetType: MenuTargetType.PLAYER,
        targetName: targetName,
        targetLevel: -1,
        actionIndex: 2, // OPPLAYER3 - Follow
        onClick: () => callbacks.onFollowPlayer(serverId),
    });

    // Trade with player
    actions.push({
        option: "Trade with",
        targetId: serverId,
        targetType: MenuTargetType.PLAYER,
        targetName: targetName,
        targetLevel: -1,
        actionIndex: 1, // OPPLAYER2 - Trade with
        onClick: () => callbacks.onTradePlayer(serverId),
    });

    // Use item on player
    if (ctx.selectedItem) {
        actions.push({
            option: "Use",
            targetId: -1,
            targetType: MenuTargetType.PLAYER,
            targetName: `${ctx.selectedItem.itemName} -> ${targetName}`,
            targetLevel: -1,
            onClick: (entry?: MenuEntry) =>
                callbacks.onUseItemOn(ensureMenuEntry(entry), { playerServerId: serverId | 0 }),
        });
    }

    return { actions };
}

/**
 * Check if mouse position is in a UI region (chatbox, minimap, sidebar)
 * OSRS parity: The Java client uses dynamic region checks based on frame dimensions
 */
export function isMouseInUIRegion(
    mx: number,
    my: number,
    canvasWidth: number,
    canvasHeight: number,
): boolean {
    const fw = canvasWidth;
    const fh = canvasHeight;

    // Java: Bottom-right buttons area (adjusts based on screen width)
    const bottomRightX = fw - (fw <= 1000 ? 240 : 420);
    const bottomRightY = fh - (fw <= 1000 ? 90 : 37);
    if (mx >= bottomRightX && mx <= fw && my >= bottomRightY && my <= fh) {
        return true;
    }

    // Chatbox region: bottom-left area
    if (mx < 519 && my > fh - 175) {
        return true;
    }

    // Minimap/orbs region: top-right area
    if (mx >= fw - 216 && mx <= fw && my >= 0 && my <= 172) {
        return true;
    }

    // Sidebar/tab area (right side)
    if (fw > 1000) {
        // Wide screen: tabs at bottom-right
        const inTabButtons = mx >= fw - 420 && mx <= fw && my >= fh - 37 && my <= fh;
        const inTabPanel = mx >= fw - 225 && mx <= fw && my >= fh - 37 - 274 && my <= fh;
        if (inTabButtons || inTabPanel) {
            return true;
        }
    } else {
        // Narrower screen: tabs stacked
        const inTabButtons = mx >= fw - 210 && mx <= fw && my >= fh - 74 && my <= fh;
        const inTabPanel = mx >= fw - 225 && mx <= fw && my >= fh - 74 - 274 && my <= fh;
        if (inTabButtons || inTabPanel) {
            return true;
        }
    }

    return false;
}
