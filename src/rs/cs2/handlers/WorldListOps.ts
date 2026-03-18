/**
 * World list operations
 */
import { Opcodes } from "../Opcodes";
import type { HandlerMap } from "./HandlerTypes";

export function registerWorldListOps(handlers: HandlerMap): void {
    handlers.set(Opcodes.WORLDLIST_FETCH, (ctx) => {
        ctx.pushInt(0); // fetch status
    });

    handlers.set(Opcodes.WORLDLIST_START, (ctx) => {
        ctx.pushInt(0); // world count
    });

    handlers.set(Opcodes.WORLDLIST_NEXT, (ctx) => {
        ctx.pushInt(0); // world id
        ctx.pushInt(0); // flags
        ctx.pushString(""); // host
        ctx.pushString(""); // activity
        ctx.pushInt(0); // location
        ctx.pushInt(0); // player count
    });

    handlers.set(Opcodes.WORLDLIST_SPECIFIC, (ctx) => {
        ctx.intStackSize--; // pop world id
        ctx.pushInt(0); // flags
        ctx.pushString(""); // host
        ctx.pushString(""); // activity
        ctx.pushInt(0); // location
        ctx.pushInt(0); // player count
    });

    handlers.set(Opcodes.WORLDLIST_SORT, (ctx) => {
        ctx.intStackSize -= 2; // pop sort type, ascending
    });
}
