import { type ScriptModule } from "../types";

export const bankerInteractionsModule: ScriptModule = {
    id: "content.bankers",
    register(registry) {
        registry.registerNpcAction("bank", ({ player, services }) => {
            services.openBank(player, { mode: "bank" });
            // Immediate user feedback
            services.sendGameMessage(player, "The bank interface opens.");
            services.logger?.info?.(
                `[script:bankers] opened bank interface for player=${player.id}`,
            );
        });
        registry.registerNpcAction("collect", ({ player, services }) => {
            services.openBank(player, { mode: "collect" });
            services.sendGameMessage(player, "The bank interface opens.");
            services.logger?.info?.(
                `[script:bankers] opened banker collect interface for player=${player.id}`,
            );
        });
    },
};
