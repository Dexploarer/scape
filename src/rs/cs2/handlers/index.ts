/**
 * Handler registry - combines all opcode handlers
 */
import { registerChatOps } from "./ChatOps";
import { registerClanOps } from "./ClanOps";
import { registerClientOps } from "./ClientOps";
import { registerConfigOps } from "./ConfigOps";
import { registerCoreOps } from "./CoreOps";
import { registerDbOps } from "./DbOps";
import type { HandlerMap } from "./HandlerTypes";
import { registerMarketOps } from "./MarketOps";
import { registerMathOps } from "./MathOps";
import { registerSocialOps } from "./SocialOps";
import { registerStringOps } from "./StringOps";
import { registerVarOps } from "./VarOps";
import { registerWidgetEventOps } from "./WidgetEventOps";
import { registerWidgetOps } from "./WidgetOps";
import { registerWorldListOps } from "./WorldListOps";
import { registerWorldMapOps } from "./WorldMapOps";

export * from "./HandlerTypes";

/** Create a handler map with all registered handlers */
export function createHandlerMap(): HandlerMap {
    const handlers: HandlerMap = new Map();

    registerCoreOps(handlers);
    registerMathOps(handlers);
    registerStringOps(handlers);
    registerVarOps(handlers);
    registerWidgetOps(handlers);
    registerWidgetEventOps(handlers);
    registerClientOps(handlers);
    registerConfigOps(handlers);
    registerSocialOps(handlers);
    registerChatOps(handlers);
    registerClanOps(handlers);
    registerWorldMapOps(handlers);
    registerMarketOps(handlers);
    registerDbOps(handlers);
    registerWorldListOps(handlers);

    return handlers;
}
