/** Shop main interface */
export const SHOP_INTERFACE_ID = 300;

/** Shop inventory side panel */
export const SHOP_INVENTORY_INTERFACE_ID = 301;

/** Shop stock inventory ID (inv 516) */
export const SHOP_STOCK_INV_ID = 516;

/** Shop stock component within interface 300 */
export const SHOP_STOCK_COMPONENT = 16;

/**
 * Flags for shop stock widget (300:16)
 * Enables: ops 1-6 (buy 1/5/10/50), op 9, op 10 (examine)
 */
export const SHOP_STOCK_FLAGS = 1662;

/**
 * Flags for shop inventory widget (301:0)
 * Enables: ops 1-5 (sell 1/5/10/50), op 10 (examine)
 */
export const SHOP_INV_FLAGS = 1086;

/** interface_inv_init - initializes inventory side panel with sell options */
export const SCRIPT_INTERFACE_INV_INIT = 149;

/** shop_main_init - initializes main shop interface */
export const SCRIPT_SHOP_MAIN_INIT = 1074;
