import type { ScriptModule } from "../../../src/game/scripts/types";
import { prayerAltarModule } from "./altars";
import { prayerModule } from "./prayer";

const prayerSubmodules: ScriptModule[] = [
    prayerModule,
    prayerAltarModule,
];

export const prayerSkillModule: ScriptModule = {
    id: "vanilla-skills.prayer",
    register(registry, services) {
        for (const sub of prayerSubmodules) {
            sub.register(registry, services);
        }
    },
};
