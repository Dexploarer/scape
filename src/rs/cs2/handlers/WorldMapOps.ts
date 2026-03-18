/**
 * World map operations
 */
import { Opcodes } from "../Opcodes";
import type { HandlerMap } from "./HandlerTypes";

export function registerWorldMapOps(handlers: HandlerMap): void {
    handlers.set(Opcodes.WORLDMAP_GETMAPNAME, (ctx) => {
        ctx.intStackSize--; // pop map id
        ctx.pushString("World Map");
    });

    handlers.set(Opcodes.WORLDMAP_SETMAP, (ctx) => {
        ctx.intStackSize--; // pop map id
    });

    handlers.set(Opcodes.WORLDMAP_GETZOOM, (ctx) => {
        ctx.pushInt(100);
    });

    handlers.set(Opcodes.WORLDMAP_SETZOOM, (ctx) => {
        ctx.intStackSize--; // pop zoom
    });

    handlers.set(Opcodes.WORLDMAP_ISLOADED, (ctx) => {
        ctx.pushInt(1);
    });

    handlers.set(Opcodes.WORLDMAP_JUMPTODISPLAYCOORD, (ctx) => {
        ctx.intStackSize--; // pop coord
    });

    handlers.set(Opcodes.WORLDMAP_JUMPTODISPLAYCOORD_INSTANT, (ctx) => {
        ctx.intStackSize--; // pop coord
    });

    handlers.set(Opcodes.WORLDMAP_JUMPTOSOURCECOORD, (ctx) => {
        ctx.intStackSize--; // pop coord
    });

    handlers.set(Opcodes.WORLDMAP_JUMPTOSOURCECOORD_INSTANT, (ctx) => {
        ctx.intStackSize--; // pop coord
    });

    handlers.set(Opcodes.WORLDMAP_GETDISPLAYPOSITION, (ctx) => {
        ctx.pushInt(0);
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETCONFIGORIGIN, (ctx) => {
        ctx.intStackSize--; // pop config id
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETCONFIGSIZE, (ctx) => {
        ctx.intStackSize--; // pop config id
        ctx.pushInt(0);
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETCONFIGBOUNDS, (ctx) => {
        ctx.intStackSize--; // pop config id
        ctx.pushInt(0);
        ctx.pushInt(0);
        ctx.pushInt(0);
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETCONFIGZOOM, (ctx) => {
        ctx.intStackSize--; // pop config id
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETCURRENTMAP, (ctx) => {
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETDISPLAYCOORD, (ctx) => {
        ctx.intStackSize--; // pop input
        ctx.pushInt(0);
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_COORDINMAP, (ctx) => {
        // worldmap_coordinmap(wma, coord) -> boolean
        // Returns true if the coordinate is within the world map area
        // STUB: Return true to prevent infinite loops in worldmap_findcoordinmap
        // which iterates through Y coordinates until this returns true.
        // A proper implementation would check if coord is within wma's bounds.
        ctx.intStackSize -= 2; // pop coord, map
        ctx.pushInt(1); // Return true to exit search loops early
    });

    handlers.set(Opcodes.WORLDMAP_GETSIZE, (ctx) => {
        ctx.pushInt(0);
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_PERPETUALFLASH, (ctx) => {
        ctx.intStackSize--; // pop enabled
    });

    handlers.set(Opcodes.WORLDMAP_FLASHELEMENT, (ctx) => {
        ctx.intStackSize--; // pop element
    });

    handlers.set(Opcodes.WORLDMAP_FLASHELEMENTCATEGORY, (ctx) => {
        ctx.intStackSize--; // pop category
    });

    handlers.set(Opcodes.WORLDMAP_STOPCURRENTFLASHES, () => {
        // No-op
    });

    handlers.set(Opcodes.WORLDMAP_DISABLEELEMENTS, (ctx) => {
        ctx.intStackSize--; // pop disabled
    });

    handlers.set(Opcodes.WORLDMAP_DISABLEELEMENT, (ctx) => {
        ctx.intStackSize -= 2; // pop element, disabled
    });

    handlers.set(Opcodes.WORLDMAP_DISABLEELEMENTCATEGORY, (ctx) => {
        ctx.intStackSize -= 2; // pop category, disabled
    });

    handlers.set(Opcodes.WORLDMAP_GETDISABLEELEMENTS, (ctx) => {
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETDISABLEELEMENT, (ctx) => {
        ctx.intStackSize--; // pop element
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_GETDISABLEELEMENTCATEGORY, (ctx) => {
        ctx.intStackSize--; // pop category
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_LISTELEMENT_START, (ctx) => {
        ctx.intStackSize--; // pop input
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_LISTELEMENT_NEXT, (ctx) => {
        ctx.intStackSize--; // pop input
        ctx.pushInt(-1);
    });

    handlers.set(Opcodes.WORLDMAP_ELEMENT, (ctx) => {
        ctx.pushInt(0);
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.WORLDMAP_ELEMENTCOORD, (ctx) => {
        ctx.pushInt(0);
    });
}
