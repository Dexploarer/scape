import { type ScriptModule } from "../types";

export const bankLocationModule: ScriptModule = {
    id: "content.bank-locations",
    register(registry) {
        registry.registerLocAction("bank", ({ player, services }) => {
            services.openBank(player, { mode: "bank" });
            services.sendGameMessage(player, "The bank interface opens.");
            services.logger?.info?.(
                `[script:bank-locations] opened bank interface for player=${player.id}`,
            );
        });
    },
};
