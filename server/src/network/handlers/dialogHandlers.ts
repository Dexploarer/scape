import type { MessageHandlerServices } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";

export function registerDialogHandlers(router: MessageRouter, services: MessageHandlerServices): void {
    router.register("resume_countdialog", (ctx) => {
        if (!ctx.player) return;
        const normalized = Math.max(
            -2147483648,
            Math.min(2147483647, Math.floor(ctx.payload.amount)),
        );
        ctx.player.bank.setBankCustomQuantity(normalized);
        ctx.player.taskQueue.submitReturnValue(normalized);
    });

    router.register("resume_namedialog", (ctx) => {
        if (!ctx.player) return;
        ctx.player.taskQueue.submitReturnValue(ctx.payload.value);
    });

    router.register("resume_stringdialog", (ctx) => {
        if (!ctx.player) return;
        ctx.player.taskQueue.submitReturnValue(ctx.payload.value);
    });
}
