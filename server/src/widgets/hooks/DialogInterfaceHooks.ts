/**
 * DialogInterfaceHooks - Dialog interface lifecycle hooks
 *
 * Based on RSMod's dialog pattern.
 * Registers on_interface_open and on_interface_close hooks for dialog interfaces.
 *
 * Dialog interfaces:
 * - 231: NPC dialog
 * - 217: Player dialog
 * - 193: Sprite (item) dialog
 * - 11: Double sprite dialog
 * - 219: Options dialog
 *
 * All dialogs mount on chatbox (162:567) and use varbit 10670 to expand CHATMODAL.
 * NOTE: RSMod uses CHATBOX_CHILD=561 which doesn't exist in our cache.
 * In this cache, 162:567 is the unclamped CHATMODAL slot and 162:566 is the overlay sibling.
 */
import type { PlayerState } from "../../game/player";
import type { InterfaceHookContext, InterfaceService } from "../InterfaceService";
import {
    DIALOG_DOUBLE_SPRITE_ID,
    DIALOG_NPC_ID,
    DIALOG_OPTIONS_ID,
    DIALOG_PLAYER_ID,
    DIALOG_SPRITE_ID,
    VARBIT_CHATMODAL_UNCLAMP,
    VARBIT_DIALOG_MODE,
} from "../InterfaceService";

/**
 * Continue button component ID for NPC/Player dialogs.
 * Component 5 is the "Click here to continue" text widget.
 */
const DIALOG_CONTINUE_COMPONENT = 5;
const DOUBLE_SPRITE_CONTINUE_COMPONENT = 4;

/**
 * Options container component ID for options dialog.
 * Component 1 contains the dynamically created option buttons.
 */
const OPTIONS_CONTAINER_COMPONENT = 1;

/**
 * Flags to enable clicking on a widget (pause button style).
 * Enables op 1 (click).
 */
const CLICK_ENABLED_FLAGS = 1;

/**
 * Register dialog interface hooks with the InterfaceService.
 * Should be called once at server startup.
 *
 * @param interfaceService The InterfaceService to register hooks with
 */
export function registerDialogInterfaceHooks(interfaceService: InterfaceService): void {
    // =============== NPC DIALOG (231) ===============
    interfaceService.onInterfaceOpen(DIALOG_NPC_ID, (player, ctx) => {
        // Enable clicking on continue button (component 5)
        // Use setSingleWidgetFlags for a single widget, not a range of children
        const continueButtonUid = (DIALOG_NPC_ID << 16) | DIALOG_CONTINUE_COMPONENT;
        ctx.service.setSingleWidgetFlags(player, continueButtonUid, CLICK_ENABLED_FLAGS);
    });

    interfaceService.onInterfaceClose(DIALOG_NPC_ID, (player, ctx) => {
        // Reset chatmodal_unclamp varbit
        ctx.service.setVarbit(player, VARBIT_CHATMODAL_UNCLAMP, 0);
    });

    // =============== PLAYER DIALOG (217) ===============
    interfaceService.onInterfaceOpen(DIALOG_PLAYER_ID, (player, ctx) => {
        // Enable clicking on continue button (component 5)
        const continueButtonUid = (DIALOG_PLAYER_ID << 16) | DIALOG_CONTINUE_COMPONENT;
        ctx.service.setSingleWidgetFlags(player, continueButtonUid, CLICK_ENABLED_FLAGS);
    });

    interfaceService.onInterfaceClose(DIALOG_PLAYER_ID, (player, ctx) => {
        // Reset chatmodal_unclamp varbit
        ctx.service.setVarbit(player, VARBIT_CHATMODAL_UNCLAMP, 0);
    });

    // =============== SPRITE DIALOG (193) ===============
    // Note: Sprite dialog flags are set dynamically after script 2868 creates the continue button.
    // See setSpriteDialogFlags() and WidgetDialogHandler.openDialog().

    interfaceService.onInterfaceClose(DIALOG_SPRITE_ID, (player, ctx) => {
        // Reset chatmodal_unclamp varbit
        // NOTE: RSMod's itemMessageBox doesn't use this varbit because they use CHATBOX_CHILD=561.
        // Our cache uses component 567 which requires expansion via varbit 10670.
        ctx.service.setVarbit(player, VARBIT_CHATMODAL_UNCLAMP, 0);
    });

    // =============== DOUBLE SPRITE DIALOG (11) ===============
    interfaceService.onInterfaceOpen(DIALOG_DOUBLE_SPRITE_ID, (player, ctx) => {
        // Double sprite dialogs have continue button at component 4 in this cache revision.
        const continueButtonUid =
            (DIALOG_DOUBLE_SPRITE_ID << 16) | DOUBLE_SPRITE_CONTINUE_COMPONENT;
        ctx.service.setSingleWidgetFlags(player, continueButtonUid, CLICK_ENABLED_FLAGS);
    });

    interfaceService.onInterfaceClose(DIALOG_DOUBLE_SPRITE_ID, (player, ctx) => {
        ctx.service.setVarbit(player, VARBIT_CHATMODAL_UNCLAMP, 0);
    });

    // =============== OPTIONS DIALOG (219) ===============
    // Note: Options dialog flags are set dynamically based on option count.
    // The hook here handles the close cleanup.
    interfaceService.onInterfaceClose(DIALOG_OPTIONS_ID, (player, ctx) => {
        // Reset chatmodal_unclamp varbit
        ctx.service.setVarbit(player, VARBIT_CHATMODAL_UNCLAMP, 0);
        // Reset dialog mode varbit
        ctx.service.setVarbit(player, VARBIT_DIALOG_MODE, 0);
    });
}

/**
 * Set options dialog flags based on the number of options.
 * Called after the dialog options are created via script 58.
 *
 * @param service The InterfaceService
 * @param player The player
 * @param optionCount Number of options (1-5)
 */
export function setOptionsDialogFlags(
    service: InterfaceService,
    player: PlayerState,
    optionCount: number,
): void {
    // Dynamic children created by script 58 have childIndex 1 through optionCount
    const optionsContainerUid = (DIALOG_OPTIONS_ID << 16) | OPTIONS_CONTAINER_COMPONENT;
    service.setWidgetFlags(player, optionsContainerUid, 1, optionCount, CLICK_ENABLED_FLAGS);
}

/**
 * Set sprite dialog flags for the continue button.
 * Called after script 2868 creates the continue button.
 *
 * Widget structure for 193.0 (Objectbox.UNIVERSE):
 * - 193.0[0]: hidden placeholder (type 3)
 * - 193.0[1]: hidden placeholder (type 3)
 * - 193.0[2]: "Click here to continue" button (type 4)
 *
 * Note: RSMod uses range 0..1, but the button is at child index 2.
 *
 * @param service The InterfaceService
 * @param player The player
 */
export function setSpriteDialogFlags(service: InterfaceService, player: PlayerState): void {
    // Script 2868 creates the continue button at child index 2 of component 0
    const containerUid = DIALOG_SPRITE_ID << 16;
    service.setWidgetFlags(player, containerUid, 0, 2, CLICK_ENABLED_FLAGS);
}
