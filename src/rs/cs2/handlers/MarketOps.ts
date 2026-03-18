/**
 * Stock market and trading post operations
 */
import { Opcodes } from "../Opcodes";
import type { HandlerMap } from "./HandlerTypes";

export function registerMarketOps(handlers: HandlerMap): void {
    // === Stock Market ===
    handlers.set(Opcodes.STOCKMARKET_GETOFFERTYPE, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERITEM, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERPRICE, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERCOUNT, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERCOMPLETEDCOUNT, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERCOMPLETEDGOLD, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFEREMPTY, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(1);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFERSTABLE, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(1);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFERFINISHED, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(1);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFERADDING, (ctx) => {
        ctx.intStackSize--; // pop slot
        ctx.pushInt(0);
    });

    // === Trading Post ===
    handlers.set(Opcodes.TRADINGPOST_SORTBY_NAME, (ctx) => {
        ctx.intStackSize--; // pop ascending
    });

    handlers.set(Opcodes.TRADINGPOST_SORTBY_PRICE, (ctx) => {
        ctx.intStackSize--; // pop ascending
    });

    handlers.set(Opcodes.TRADINGPOST_SORTFILTERBY_WORLD, (ctx) => {
        ctx.intStackSize -= 2; // pop world, ascending
    });

    handlers.set(Opcodes.TRADINGPOST_SORTBY_AGE, (ctx) => {
        ctx.intStackSize--; // pop ascending
    });

    handlers.set(Opcodes.TRADINGPOST_SORTBY_COUNT, (ctx) => {
        ctx.intStackSize--; // pop ascending
    });

    handlers.set(Opcodes.TRADINGPOST_GETTOTALOFFERS, (ctx) => {
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERWORLD, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERNAME, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushString("");
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERPREVIOUSNAME, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushString("");
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERAGE, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERCOUNT, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERPRICE, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERITEM, (ctx) => {
        ctx.intStackSize--; // pop index
        ctx.pushInt(-1);
    });

    // === Hiscores ===
    handlers.set(Opcodes.HISCORE_GETSTATUS, (ctx) => {
        // Returns hiscores fetch status:
        // 0 = not fetched, 1 = loading, 2 = loaded
        // For now, return 0 (not fetched) as hiscores aren't implemented
        ctx.pushInt(0);
    });
}
