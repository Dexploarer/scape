import type { ScriptModule } from "../../../src/game/scripts/types";
import { flaxModule } from "./flax";
import { spinningModule } from "./spinning";

const craftingSubmodules: ScriptModule[] = [
    flaxModule,
    spinningModule,
];

export const craftingSkillModule: ScriptModule = {
    id: "vanilla-skills.crafting",
    register(registry, services) {
        for (const sub of craftingSubmodules) {
            sub.register(registry, services);
        }
    },
};
