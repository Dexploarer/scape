/**
 * Core VM operations: constants, control flow, stack, locals
 */
import { Opcodes } from "../Opcodes";
import type { HandlerContext, HandlerMap, HandlerResult } from "./HandlerTypes";
import { ExecutionState } from "./HandlerTypes";

export function registerCoreOps(handlers: HandlerMap): void {
    // === Constants ===
    handlers.set(Opcodes.ICONST, (ctx, intOp) => {
        ctx.pushInt(intOp);
    });

    handlers.set(Opcodes.SCONST, (ctx, _intOp, stringOp) => {
        ctx.pushString(stringOp || "");
    });

    handlers.set(Opcodes.PUSH_NULL, (ctx) => {
        ctx.pushString(null);
    });

    // === Local variables ===
    handlers.set(Opcodes.ILOAD, (ctx, intOp) => {
        // Note: localInts not available here - handled specially in VM
    });

    handlers.set(Opcodes.ISTORE, (ctx, intOp) => {
        // Note: localInts not available here - handled specially in VM
    });

    handlers.set(Opcodes.OLOAD, (ctx, intOp) => {
        // Note: localStrings not available here - handled specially in VM
    });

    handlers.set(Opcodes.OSTORE, (ctx, intOp) => {
        // Note: localStrings not available here - handled specially in VM
    });

    // === Stack operations ===
    handlers.set(Opcodes.POP_INT, (ctx) => {
        ctx.intStackSize--;
    });

    handlers.set(Opcodes.POP_OBJECT, (ctx) => {
        ctx.stringStackSize--;
    });

    // === Control flow ===
    handlers.set(Opcodes.JUMP, (ctx, intOp): HandlerResult => {
        return { jump: intOp };
    });

    handlers.set(Opcodes.IF_ICMPEQ, (ctx, intOp): HandlerResult | void => {
        const b = ctx.intStack[--ctx.intStackSize];
        const a = ctx.intStack[--ctx.intStackSize];
        if (a === b) return { jump: intOp };
    });

    handlers.set(Opcodes.IF_ICMPNE, (ctx, intOp): HandlerResult | void => {
        const b = ctx.intStack[--ctx.intStackSize];
        const a = ctx.intStack[--ctx.intStackSize];
        if (a !== b) return { jump: intOp };
    });

    handlers.set(Opcodes.IF_ICMPLT, (ctx, intOp): HandlerResult | void => {
        const b = ctx.intStack[--ctx.intStackSize];
        const a = ctx.intStack[--ctx.intStackSize];
        if (a < b) return { jump: intOp };
    });

    handlers.set(Opcodes.IF_ICMPGT, (ctx, intOp): HandlerResult | void => {
        const b = ctx.intStack[--ctx.intStackSize];
        const a = ctx.intStack[--ctx.intStackSize];
        if (a > b) return { jump: intOp };
    });

    handlers.set(Opcodes.IF_ICMPLE, (ctx, intOp): HandlerResult | void => {
        const b = ctx.intStack[--ctx.intStackSize];
        const a = ctx.intStack[--ctx.intStackSize];
        if (a <= b) return { jump: intOp };
    });

    handlers.set(Opcodes.IF_ICMPGE, (ctx, intOp): HandlerResult | void => {
        const b = ctx.intStack[--ctx.intStackSize];
        const a = ctx.intStack[--ctx.intStackSize];
        if (a >= b) return { jump: intOp };
    });

    handlers.set(Opcodes.RETURN, (): HandlerResult => {
        return { return: true, state: ExecutionState.FINISHED };
    });

    // === Switch ===
    // SWITCH is handled specially in VM due to switch table access
}
