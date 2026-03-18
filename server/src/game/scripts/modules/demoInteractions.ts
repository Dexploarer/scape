import { type ScriptModule } from "../types";

/**
 * Lightweight demo module that proves out the script registry/runtime pipeline.
 * Handlers are intentionally no-ops beyond logging so they can be used as a reference
 * for future content authors. Switch on ENABLE_DEMO_SCRIPTS to emit the debug output.
 */
export const demoInteractionsModule: ScriptModule = {
    id: "demo.interactions",
    register(registry, _services) {
        if (process.env.ENABLE_DEMO_SCRIPTS !== "1") return;

        registry.registerNpcScript({
            npcId: 0,
            option: undefined,
            handler: ({ tick, player, npc, option }) => {
                console.log(
                    `[demo-script] tick=${tick} player=${player.id} interacted with npc=${
                        npc.id
                    } option=${option ?? "default"}`,
                );
            },
        });

        registry.registerLocScript({
            locId: 0,
            action: undefined,
            handler: ({ tick, player, locId, action, tile }) => {
                console.log(
                    `[demo-script] tick=${tick} player=${
                        player.id
                    } interacted with loc=${locId} action=${action ?? "default"} at (${tile.x},${
                        tile.y
                    })`,
                );
            },
        });
    },
};
