import type { GamemodeDefinition } from "./GamemodeDefinition";
import { LeaguesVGamemode } from "./leagues-v";
import { VanillaGamemode } from "./vanilla";

const GAMEMODE_FACTORIES: Record<string, () => GamemodeDefinition> = {
    "vanilla": () => new VanillaGamemode(),
    "leagues-v": () => new LeaguesVGamemode(),
};

export function createGamemode(id: string): GamemodeDefinition {
    const factory = GAMEMODE_FACTORIES[id];
    if (!factory) {
        const available = Object.keys(GAMEMODE_FACTORIES).join(", ");
        throw new Error(`Unknown gamemode "${id}". Available: ${available}`);
    }
    return factory();
}
