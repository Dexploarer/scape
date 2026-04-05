import type { IScriptRegistry, ScriptServices } from "../../../src/game/scripts/types";
import { executeBoltEnchantAction } from "./boltEnchant";
import { executeCookAction, registerCookingInteractions } from "./cooking";
import { executeSmeltAction, registerSmeltingInteractions } from "./smelting";
import { executeSmithAction, registerSmithingInteractions } from "./smithing";
import { SmithingUI } from "./smithingUI";
import { executeTanAction, registerTanningInteractions } from "./tanning";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.smith", executeSmithAction);
    registry.registerActionHandler("skill.cook", executeCookAction);
    registry.registerActionHandler("skill.tan", executeTanAction);
    registry.registerActionHandler("skill.smelt", executeSmeltAction);
    registry.registerActionHandler("skill.bolt_enchant", executeBoltEnchantAction);

    const smithingUI = new SmithingUI(services);

    const production = services.production;
    if (production) {
        production.openSmeltingInterface = (player) => smithingUI.openSmeltingInterface(player);
        production.openForgeInterface = (player) => smithingUI.openForgeInterface(player);
        production.openSmithingInterface = (player) => smithingUI.openSmithingInterface(player);
        production.smeltBars = (player, params) =>
            smithingUI.handleSmeltingSelection(player, params.recipeId, params.count > 0 ? params.count : undefined);
        production.smithItems = (player, params) =>
            smithingUI.handleSmithingSelection(player, params.recipeId, params.count > 0 ? params.count : undefined);
        production.updateSmithingInterface = (player) => smithingUI.updateSmithingInterface(player);
        production.updateSmeltingInterface = (player) => smithingUI.updateSmeltingInterface(player);
        production.getBarTypeByItemId = (itemId) => smithingUI.getBarTypeByItemId(itemId);
    }

    registry.registerClientMessageHandler("smithing_make", (event) => {
        const recipeId = (event.payload.recipeId as string) ?? "";
        const mode = event.payload.mode === "forge" ? "forge" : "smelt";
        if (mode === "forge") smithingUI.handleSmithingSelection(event.player, recipeId);
        else smithingUI.handleSmeltingSelection(event.player, recipeId);
    });

    registry.registerClientMessageHandler("smithing_mode", (event) => {
        smithingUI.handleModeChange(
            event.player,
            (event.payload.mode as number) ?? event.player.getSmithingQuantityMode(),
            event.payload.custom as number | undefined,
        );
    });

    registerSmithingInteractions(registry, services);
    registerCookingInteractions(registry, services);
    registerSmeltingInteractions(registry, services);
    registerTanningInteractions(registry, services);
}
