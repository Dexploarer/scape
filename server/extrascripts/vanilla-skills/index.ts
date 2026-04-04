import type { ScriptModule } from "../../src/game/scripts/types";
import { craftingSkillModule } from "./crafting/index";
import { fletchingModule } from "./fletching/index";
import { herbloreModule } from "./herblore/index";
import { prayerSkillModule } from "./prayer/index";
import { thievingModule } from "./thieving/index";

const skillModules: ScriptModule[] = [
    thievingModule,
    herbloreModule,
    prayerSkillModule,
    fletchingModule,
    craftingSkillModule,
];

export const module: ScriptModule = {
    id: "vanilla-skills",
    register(registry, services) {
        for (const skill of skillModules) {
            skill.register(registry, services);
        }
    },
};
