/**
 * EquipmentStatsInterfaceHooks - Equipment stats interface lifecycle hooks
 *
 * Based on RSMod's equipment_stats.plugin.kts pattern.
 * Registers on_interface_close hook for the equipment stats interface.
 *
 * Flow:
 * 1. Equipment stats opens (84) -> Equipment inventory (85) opens in sidemodal
 * 2. Equipment stats closes (84) -> Equipment inventory (85) closes
 *
 * Usage:
 * ```ts
 * const interfaceService = new InterfaceService(dispatcher);
 * registerEquipmentStatsInterfaceHooks(interfaceService);
 * ```
 */
import type { InterfaceService } from "../InterfaceService";

// Equipment stats interface (main screen showing bonuses)
const EQUIPMENT_STATS_INTERFACE_ID = 84;

// Equipment inventory interface (sidemodal with inventory for equipping)
const EQUIPMENT_INVENTORY_INTERFACE_ID = 85;

/**
 * Register equipment stats interface hooks with the InterfaceService.
 * Should be called once at server startup.
 *
 * @param interfaceService The InterfaceService to register hooks with
 */
export function registerEquipmentStatsInterfaceHooks(interfaceService: InterfaceService): void {
    // =============== ON EQUIPMENT STATS CLOSE ===============
    // When the main equipment stats interface (84) closes, also close the
    // equipment inventory sidemodal (85) and restore normal tab visibility.
    interfaceService.onInterfaceClose(EQUIPMENT_STATS_INTERFACE_ID, (player, ctx) => {
        // Check if equipment inventory sidemodal is open
        if (ctx.service.getCurrentSidemodal(player) === EQUIPMENT_INVENTORY_INTERFACE_ID) {
            ctx.service.closeSidemodal(player);
        }
    });
}
