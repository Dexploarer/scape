/**
 * ShopInterfaceHooks - Shop interface lifecycle hooks
 *
 * Based on RSMod's shops.plugin.kts pattern.
 * Registers on_interface_open and on_interface_close hooks for the shop interface.
 *
 * Flow:
 * 1. Shop opens (300) -> Initialize shop inventory side panel (301) with script 149
 * 2. Shop closes (300) -> Close shop inventory (301), restore normal inventory (149)
 *
 * Usage:
 * ```ts
 * const interfaceService = new InterfaceService(dispatcher);
 * registerShopInterfaceHooks(interfaceService);
 *
 * // Now when you open a shop, the hooks handle everything:
 * interfaceService.openModal(player, SHOP_INTERFACE_ID, { shopSnapshot });
 * ```
 */
import type { PlayerState } from "../../../src/game/player";
import type { InterfaceHookContext, InterfaceService } from "../../../src/widgets/InterfaceService";
import {
    GameframeTab,
    PLAYER_INV_ID,
    SCRIPT_INTERFACE_INV_INIT,
    SCRIPT_SHOP_MAIN_INIT,
    SHOP_INTERFACE_ID,
    SHOP_INVENTORY_INTERFACE_ID,
    SHOP_INV_FLAGS,
    SHOP_STOCK_COMPONENT,
    SHOP_STOCK_FLAGS,
    SHOP_STOCK_INV_ID,
} from "../../../src/widgets/InterfaceService";

/**
 * Shop snapshot data passed when opening a shop.
 * This is the data attached to the modal via interfaceService.openModal().
 */
export interface ShopOpenData {
    shopId: string;
    name: string;
    currencyItemId?: number;
    generalStore?: boolean;
    showBuy50?: boolean;
    stock: Array<{
        itemId: number;
        quantity: number;
        baseStock: number;
        basePrice: number;
    }>;
}

/**
 * Register shop interface hooks with the InterfaceService.
 * Should be called once at server startup.
 *
 * @param interfaceService The InterfaceService to register hooks with
 */
export function registerShopInterfaceHooks(interfaceService: InterfaceService): void {
    // =============== ON SHOP OPEN ===============
    interfaceService.onInterfaceOpen(SHOP_INTERFACE_ID, (player, ctx) => {
        const shopData = ctx.data as ShopOpenData | undefined;
        if (!shopData) {
            console.warn("[ShopHooks] onOpen: No shop data provided");
            return;
        }

        // 1. Initialize main shop interface with script 1074 (shop_main_init)
        initializeShopMain(ctx.service, player, shopData);

        // 2. Open and initialize shop inventory side panel (301)
        initializeShopInventorySidePanel(ctx.service, player);

        // 3. Set IF_SETEVENTS for shop stock widget (300:16)
        const shopStockWidgetUid = (SHOP_INTERFACE_ID << 16) | SHOP_STOCK_COMPONENT;
        ctx.service.setWidgetFlags(player, shopStockWidgetUid, 0, 39, SHOP_STOCK_FLAGS);

        // 4. Focus the inventory tab so player can easily sell items
        // RSMod equivalent: player.focusTab(GameframeTab.INVENTORY)
        ctx.service.focusTab(player, GameframeTab.INVENTORY);
    });

    // =============== ON SHOP CLOSE ===============
    interfaceService.onInterfaceClose(SHOP_INTERFACE_ID, (player, ctx) => {
        // Restore normal inventory when shop closes
        // RSMod equivalent:
        //   player.closeInterface(interfaceId = INV_INTERFACE_ID)
        //   player.openInterface(dest = InterfaceDestination.INVENTORY)
        ctx.service.restoreNormalInventory(player);
    });
}

/**
 * Run the shop_main_init script (1074) to initialize the main shop interface.
 *
 * Script 1074 (shop_main_init) expects:
 * - inv $inv0: Shop stock inventory (516)
 * - string $text0: Shop name
 * - obj $obj1: Currency item ID (995 = coins)
 * - int $int2: Price modifier/display setting
 * - boolean $boolean3: Show "Buy 50" option
 */
function initializeShopMain(
    service: InterfaceService,
    player: PlayerState,
    shopData: ShopOpenData,
): void {
    const currencyItemId = shopData.currencyItemId ?? 995; // Default to coins
    const showBuy50 = shopData.showBuy50 !== false; // Default to true

    service.runScript(player, SCRIPT_SHOP_MAIN_INIT, [
        SHOP_STOCK_INV_ID, // inv $inv0 (shop stock inventory)
        shopData.name, // string $text0 (shop name)
        currencyItemId, // obj $obj1 (currency item)
        0, // int $int2 (price modifier/display setting)
        showBuy50 ? 1 : 0, // boolean $boolean3 (show "Buy 50" option)
    ]);
}

/**
 * Initialize the shop inventory side panel (301) with script 149 (interface_inv_init).
 *
 * This sets up the player's inventory display with sell options.
 * Script 149 (interface_inv_init) expects:
 * - component $component0: The container widget
 * - inv $inv1: The inventory to display (93 = player inventory)
 * - int $int2: Columns
 * - int $int3: Rows
 * - int $int4: Unknown flag
 * - component $component5: Scrollbar component (-1 = none)
 * - string $string0-4: Op labels (Value, Sell 1, Sell 5, Sell 10, Sell 50)
 */
function initializeShopInventorySidePanel(service: InterfaceService, player: PlayerState): void {
    const shopInvWidgetUid = SHOP_INVENTORY_INTERFACE_ID << 16;

    service.openInventorySidePanel(player, {
        interfaceId: SHOP_INVENTORY_INTERFACE_ID,
        initScript: {
            scriptId: SCRIPT_INTERFACE_INV_INIT,
            args: [
                shopInvWidgetUid, // component $component0 (shop_inventory:0)
                PLAYER_INV_ID, // inv $inv1 (player inventory)
                4, // int $int2 (columns)
                7, // int $int3 (rows)
                0, // int $int4 (unknown flag)
                -1, // component $component5 (scrollbar, -1 = none)
                "Value", // string $string0 (op1 label)
                "Sell 1", // string $string1 (op2 label)
                "Sell 5", // string $string2 (op3 label)
                "Sell 10", // string $string3 (op4 label)
                "Sell 50", // string $string4 (op5 label)
            ],
        },
        setFlags: {
            uid: shopInvWidgetUid,
            fromSlot: 0,
            toSlot: 27,
            flags: SHOP_INV_FLAGS,
        },
    });
}
