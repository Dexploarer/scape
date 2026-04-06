import type { MessageRouter } from "../MessageRouter";
import type { MessageHandlerServices } from "../MessageHandlers";
import { createLogoutHandler } from "./logoutHandler";
import { createIfCloseHandler } from "./ifCloseHandler";
import { createWidgetHandler } from "./widgetHandler";
import { createVarpTransmitHandler } from "./varpTransmitHandler";
import { type BinaryHandlerExtServices, registerBinaryHandlers } from "./binaryMessageHandlers";
import { registerInteractHandlers } from "./interactHandlers";
import { registerDialogHandlers } from "./dialogHandlers";
import { registerMovementHandlers } from "./movementHandlers";
import { registerNpcHandlers } from "./npcHandlers";
import { registerSpellHandlers } from "./spellHandlers";
import { registerDebugHandler } from "./debugHandler";
import { registerChatHandler } from "./chatHandler";

export type { BinaryHandlerExtServices };

/**
 * Registers ALL message handlers with the router.
 * This is the single entry point for handler registration.
 *
 * To add a new handler:
 * 1. Create a handler file in this directory
 * 2. Export a registerXxxHandlers(router, services) function
 * 3. Register it here
 */
export function registerAllHandlers(
    router: MessageRouter,
    services: BinaryHandlerExtServices,
): void {
    // Gameplay handlers (extracted from MessageHandlers.ts)
    registerInteractHandlers(router, services);
    registerDialogHandlers(router, services);
    registerMovementHandlers(router, services);
    registerNpcHandlers(router, services);
    registerSpellHandlers(router, services);
    registerDebugHandler(router, services);
    registerChatHandler(router, services);

    // Extracted from onConnection if-else chain
    router.register("logout", createLogoutHandler(services));
    router.register("if_close", createIfCloseHandler(services));
    router.register("widget", createWidgetHandler(services));
    router.register("varp_transmit", createVarpTransmitHandler(services));

    // Extracted from processBinaryMessage switch
    registerBinaryHandlers(router, services);
}
