import { type ScriptModule } from "../types";

export const shopInteractionsModule: ScriptModule = {
    id: "content.shops",
    register(registry) {
        registry.registerNpcAction("trade", ({ player, services, npc }) => {
            if (!services.openShop) {
                services.sendGameMessage(player, "Nothing interesting happens.");
                services.logger?.warn?.(
                    `[script:shops] openShop service missing for player=${player.id}`,
                );
                return;
            }
            services.openShop(player, { npcTypeId: npc?.typeId });
        });
        registry.registerNpcAction("trade-with", ({ player, services, npc }) => {
            if (!services.openShop) {
                services.sendGameMessage(player, "Nothing interesting happens.");
                services.logger?.warn?.(
                    `[script:shops] openShop service missing for player=${player.id}`,
                );
                return;
            }
            services.openShop(player, { npcTypeId: npc?.typeId });
        });
    },
};
