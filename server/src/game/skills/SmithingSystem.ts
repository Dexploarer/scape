import { SkillId } from "../../../../src/rs/skill/skills";
import type { PlayerState } from "../player";
import type { SmithingOptionMessage, SmithingServerPayload } from "../../network/messages";
import type { ActionScheduler } from "../actions/ActionScheduler";
import {
    HAMMER_ITEM_ID,
    SMELTING_RECIPES,
    SMITHING_RECIPES,
    type SmeltingRecipe,
    calculateIronSmeltChance,
    computeSmeltingBatchCount,
    getSmeltingRecipeById,
    getSmithingRecipeById,
    shouldGuaranteeIronSmelt,
} from "./smithingBonuses";
import { getItemDefinition } from "../../data/items";

const SMITHING_GROUP_ID = 312;
const SMITHING_BAR_TYPE_VARBIT_ID = 3216;
const SMITHING_BAR_ENUM_ID = 1253;
const SMITHING_BAR_TYPE_FALLBACK: ReadonlyArray<readonly [number, number]> = [
    [1, 2349], [2, 2351], [3, 2353], [4, 2355], [5, 2357], [6, 2359], [7, 2361], [8, 2363],
];
const SMITHING_BAR_MIN_LEVEL_BY_TYPE: Readonly<Record<number, number>> = {
    1: 1, 2: 15, 3: 30, 4: 50, 5: 70, 6: 85, 7: 40, 8: 20,
};

export interface SmithingSystemServices {
    getInventory(player: PlayerState): Array<{ itemId: number; quantity: number }>;
    playerHasItem(player: PlayerState, itemId: number): boolean;
    countInventoryItem(player: PlayerState, itemId: number): number;
    queueSmithingMessage(playerId: number, payload: SmithingServerPayload): void;
    queueChatMessage(request: { messageType: string; text: string; targetPlayerIds?: number[] }): void;
    openModal(player: PlayerState, groupId: number, data?: unknown, opts?: { varbits?: Record<number, number> }): void;
    closeModal(player: PlayerState): void;
    isModalOpen(player: PlayerState, groupId: number): boolean;
    openSmithingBarModal(player: PlayerState): void;
    requestAction(playerId: number, request: any, tick: number): { ok: boolean };
    getCurrentTick(): number;
    getEnumTypeLoader(): { load(id: number): { keys: number[]; intValues: number[] } | undefined } | undefined;
    buildSkillFailure(player: PlayerState, message: string, reason: string): any;
}

/**
 * Extracted smithing/smelting system.
 * Manages the smithing interface, recipe resolution, bar enum cache,
 * and action scheduling for smithing/smelting operations.
 */
export class SmithingSystem {
    private barTypeToItemId = new Map<number, number>();
    private barItemIdToType = new Map<number, number>();
    private barEnumInitialized = false;

    constructor(private readonly services: SmithingSystemServices) {}

    buildSmeltingOptions(player: PlayerState): SmithingOptionMessage[] {
        const inventory = this.services.getInventory(player);
        const smithLevel = player.getSkill(SkillId.Smithing).baseLevel;
        return SMELTING_RECIPES.map((recipe) => {
            const available = Math.max(0, Math.min(28, computeSmeltingBatchCount(inventory, recipe)));
            return {
                recipeId: recipe.id,
                name: recipe.name,
                level: recipe.level,
                itemId: recipe.outputItemId,
                outputQuantity: Math.max(1, recipe.outputQuantity),
                available,
                canMake: available > 0 && smithLevel >= recipe.level,
                xp: recipe.xp,
                ingredientsLabel: recipe.ingredientsLabel,
                mode: "smelt",
            };
        });
    }

    buildForgingOptions(player: PlayerState): SmithingOptionMessage[] {
        const inventory = this.services.getInventory(player);
        const smithLevel = player.getSkill(SkillId.Smithing).baseLevel;
        const hammerAvailable = this.services.playerHasItem(player, HAMMER_ITEM_ID);
        return SMITHING_RECIPES.map((recipe) => {
            const available = Math.max(
                0,
                Math.min(28, this.computeBatchCountFromInventory(inventory, recipe)),
            );
            const canLevel = smithLevel >= recipe.level;
            const requiresHammer = recipe.requireHammer !== false;
            return {
                recipeId: recipe.id,
                name: recipe.name,
                level: recipe.level,
                itemId: recipe.outputItemId,
                outputQuantity: Math.max(1, recipe.outputQuantity),
                available,
                canMake: (!requiresHammer || hammerAvailable) && canLevel && available > 0,
                xp: recipe.xp,
                ingredientsLabel: `${recipe.barCount} x ${this.describeBar(recipe.barItemId)}`,
                mode: "forge",
                barItemId: recipe.barItemId,
                barCount: recipe.barCount,
                requiresHammer,
                hasHammer: requiresHammer ? hammerAvailable : true,
            };
        });
    }

    sendInterfaceState(
        player: PlayerState,
        action: "open" | "update",
        mode: "smelt" | "forge",
    ): void {
        if (action === "open") {
            try {
                let openVarbits: Record<number, number> | undefined;
                if (mode === "forge") {
                    const openState = this.resolveOpenVarbits(player);
                    if (!openState.ok) return;
                    openVarbits = openState.varbits;
                }
                this.services.openModal(
                    player,
                    SMITHING_GROUP_ID,
                    undefined,
                    openVarbits ? { varbits: openVarbits } : undefined,
                );
            } catch {}
        }
        const options =
            mode === "smelt" ? this.buildSmeltingOptions(player) : this.buildForgingOptions(player);
        this.services.queueSmithingMessage(player.id, {
            kind: action,
            mode,
            title: mode === "smelt" ? "Smelting" : "Smithing",
            options,
            quantityMode: player.getSmithingQuantityMode(),
            customQuantity: player.getSmithingCustomQuantity(),
        });
    }

    openSmeltingInterface(player: PlayerState): void {
        this.sendInterfaceState(player, "open", "smelt");
    }

    updateSmeltingInterface(player: PlayerState): void {
        this.sendInterfaceState(player, "update", "smelt");
    }

    openForgeInterface(player: PlayerState): void {
        this.sendInterfaceState(player, "open", "forge");
    }

    openSmithingInterface(player: PlayerState): void {
        this.services.openSmithingBarModal(player);
    }

    updateSmithingInterface(player: PlayerState): void {
        this.sendInterfaceState(player, "update", "forge");
    }

    closeInterface(player: PlayerState): void {
        try {
            if (this.services.isModalOpen(player, SMITHING_GROUP_ID)) {
                this.services.closeModal(player);
            } else {
                player.widgets.close(SMITHING_GROUP_ID);
            }
        } catch {}
        this.services.queueSmithingMessage(player.id, { kind: "close" });
    }

    initializeBarEnumCache(): void {
        if (this.barEnumInitialized) return;
        this.barEnumInitialized = true;
        this.barTypeToItemId.clear();
        this.barItemIdToType.clear();

        try {
            const enumType = this.services.getEnumTypeLoader()?.load(SMITHING_BAR_ENUM_ID);
            const keys = enumType?.keys ?? [];
            const values = enumType?.intValues ?? [];
            const count = Math.min(keys.length, values.length);
            for (let i = 0; i < count; i++) {
                const barType = keys[i];
                const itemId = values[i];
                if (!(barType > 0) || !(itemId > 0)) continue;
                this.barTypeToItemId.set(barType, itemId);
                this.barItemIdToType.set(itemId, barType);
            }
        } catch {}

        if (this.barTypeToItemId.size === 0) {
            for (const [barType, itemId] of SMITHING_BAR_TYPE_FALLBACK) {
                this.barTypeToItemId.set(barType, itemId);
                this.barItemIdToType.set(itemId, barType);
            }
        }
    }

    findBarTypeForOpen(player: PlayerState): number | undefined {
        this.initializeBarEnumCache();
        const smithLevel = player.getSkill(SkillId.Smithing).baseLevel;
        const unlockedTypes: number[] = [];
        const inventoryTypes: number[] = [];

        for (const [barType, itemId] of this.barTypeToItemId.entries()) {
            if (!(itemId > 0)) continue;
            const requiredLevel = SMITHING_BAR_MIN_LEVEL_BY_TYPE[barType] ?? 1;
            if (smithLevel < requiredLevel) continue;
            unlockedTypes.push(barType);
            if (this.services.countInventoryItem(player, itemId) > 0) {
                inventoryTypes.push(barType);
            }
        }

        if (unlockedTypes.length === 0) return undefined;
        unlockedTypes.sort((a, b) => a - b);
        inventoryTypes.sort((a, b) => a - b);

        const lastBarType = player.getVarbitValue(SMITHING_BAR_TYPE_VARBIT_ID);
        if (unlockedTypes.includes(lastBarType)) return lastBarType;
        if (inventoryTypes.length > 0) return inventoryTypes[0];
        return unlockedTypes[0];
    }

    resolveOpenVarbits(
        player: PlayerState,
    ): { ok: true; varbits: Record<number, number> } | { ok: false } {
        const barType = this.findBarTypeForOpen(player);
        if (barType === undefined || !(barType > 0)) return { ok: false };
        player.setVarbitValue(SMITHING_BAR_TYPE_VARBIT_ID, barType);
        return { ok: true, varbits: { [SMITHING_BAR_TYPE_VARBIT_ID]: barType } };
    }

    interfaceFailure(
        player: PlayerState,
        message: string,
        reason: string,
        mode: "smelt" | "forge" = "smelt",
    ): any {
        const result = this.services.buildSkillFailure(player, message, reason);
        if (mode === "forge") this.updateSmithingInterface(player);
        else this.updateSmeltingInterface(player);
        return result;
    }

    resolveQuantity(mode: number, available: number, custom: number): number {
        const total = Math.max(0, available);
        switch (mode) {
            case 1: return Math.min(5, Math.max(1, total));
            case 2: return Math.min(10, Math.max(1, total));
            case 3: {
                const desired = custom > 0 ? custom : total;
                return Math.min(total, Math.max(1, desired));
            }
            case 4: return total;
            default: return total > 0 ? 1 : 0;
        }
    }

    handleModeChange(player: PlayerState, modeRaw: number, customRaw?: number): void {
        const mode = Math.max(0, Math.min(4, modeRaw));
        player.setSmithingQuantityMode(mode);
        if (mode === 3 && customRaw !== undefined && customRaw > 0) {
            player.setSmithingCustomQuantity(customRaw);
        } else if (mode !== 3 && customRaw !== undefined) {
            player.setSmithingCustomQuantity(customRaw);
        }
        this.services.queueSmithingMessage(player.id, {
            kind: "mode",
            quantityMode: player.getSmithingQuantityMode(),
            customQuantity: player.getSmithingCustomQuantity(),
        });
    }

    handleSmeltingSelection(player: PlayerState, recipeId: string, requestedCount?: number): void {
        const recipe = getSmeltingRecipeById(recipeId);
        if (!recipe) {
            this.services.queueChatMessage({ messageType: "game", text: "You can't smelt that.", targetPlayerIds: [player.id] });
            return;
        }
        const smithLevel = player.getSkill(SkillId.Smithing).baseLevel;
        if (smithLevel < recipe.level) {
            this.services.queueChatMessage({ messageType: "game", text: `You need Smithing level ${recipe.level} to smelt that.`, targetPlayerIds: [player.id] });
            return;
        }
        const inventory = this.services.getInventory(player);
        const available = computeSmeltingBatchCount(inventory, recipe);
        if (available <= 0) {
            this.services.queueChatMessage({ messageType: "game", text: "You need the proper ores to smelt that bar.", targetPlayerIds: [player.id] });
            this.updateSmeltingInterface(player);
            return;
        }
        const currentMode = player.getSmithingQuantityMode();
        const customAmount = player.getSmithingCustomQuantity();
        const desiredRaw = requestedCount && requestedCount > 0
            ? requestedCount
            : this.resolveQuantity(currentMode, available, customAmount);
        const desired = Math.max(1, Math.min(available, desiredRaw));
        const delay = recipe.delayTicks !== undefined ? Math.max(1, recipe.delayTicks) : 4;
        const tickNow = this.services.getCurrentTick();
        const result = this.services.requestAction(player.id, {
            kind: "skill.smelt",
            data: { recipeId: recipe.id, count: desired },
            delayTicks: delay,
            cooldownTicks: delay,
            groups: ["skill.smelt"],
        }, tickNow);
        if (!result.ok) {
            this.services.queueChatMessage({ messageType: "game", text: "You're too busy to do that right now.", targetPlayerIds: [player.id] });
        }
    }

    handleSmithingSelection(player: PlayerState, recipeId: string, requestedCount?: number): void {
        const recipe = getSmithingRecipeById(recipeId);
        if (!recipe) {
            this.services.queueChatMessage({ messageType: "game", text: "You can't smith that.", targetPlayerIds: [player.id] });
            return;
        }
        if (recipe.requireHammer !== false && !this.services.playerHasItem(player, HAMMER_ITEM_ID)) {
            this.services.queueChatMessage({ messageType: "game", text: "You need a hammer to smith.", targetPlayerIds: [player.id] });
            return;
        }
        const smithLevel = player.getSkill(SkillId.Smithing).baseLevel;
        if (smithLevel < recipe.level) {
            this.services.queueChatMessage({ messageType: "game", text: `You need Smithing level ${recipe.level} to smith that.`, targetPlayerIds: [player.id] });
            return;
        }
        const available = Math.max(0, Math.min(28, this.computeBatchCountFromInventory(this.services.getInventory(player), recipe)));
        if (available <= 0) {
            this.services.queueChatMessage({ messageType: "game", text: "You need more bars to smith that.", targetPlayerIds: [player.id] });
            this.updateSmithingInterface(player);
            return;
        }
        const currentMode = player.getSmithingQuantityMode();
        const customAmount = player.getSmithingCustomQuantity();
        const desiredRaw = requestedCount && requestedCount > 0
            ? requestedCount
            : this.resolveQuantity(currentMode, available, customAmount);
        const desired = Math.max(1, Math.min(available, desiredRaw));
        const delay = recipe.delayTicks !== undefined ? Math.max(1, recipe.delayTicks) : 4;
        const result = this.services.requestAction(player.id, {
            kind: "skill.smith",
            data: { recipeId: recipe.id, count: desired },
            delayTicks: delay,
            cooldownTicks: delay,
            groups: ["skill.smith"],
        }, this.services.getCurrentTick());
        if (!result.ok) {
            this.services.queueChatMessage({ messageType: "game", text: "You're too busy to do that right now.", targetPlayerIds: [player.id] });
        }
        this.updateSmithingInterface(player);
    }

    rollSmeltingSuccess(
        level: number,
        recipe: SmeltingRecipe,
        equip?: ReadonlyArray<number>,
        ringCharges?: number,
    ): boolean {
        if (shouldGuaranteeIronSmelt(recipe, equip, ringCharges)) return true;
        if (recipe.successType === "iron") {
            const chance = calculateIronSmeltChance(level);
            return Math.random() < chance;
        }
        return true;
    }

    computeBatchCountFromInventory(
        inventory: Array<{ itemId: number; quantity: number }>,
        recipe: NonNullable<ReturnType<typeof getSmithingRecipeById>>,
    ): number {
        const required = Math.max(1, recipe.barCount);
        if (required <= 0) return 0;
        let total = 0;
        for (const entry of inventory) {
            if (!entry || entry.itemId <= 0 || entry.quantity <= 0) continue;
            if (entry.itemId === recipe.barItemId) total += entry.quantity;
        }
        if (total <= 0) return 0;
        return Math.max(0, Math.floor(total / required));
    }

    describeBar(itemId: number): string {
        const def = getItemDefinition(itemId);
        return def?.name ? def.name.toLowerCase() : "bar";
    }

    describeOre(itemId: number): string {
        const def = getItemDefinition(itemId);
        return def?.name ? def.name.toLowerCase() : "ore";
    }

    getSmithingGroupId(): number {
        return SMITHING_GROUP_ID;
    }

    getBarTypeVarbitId(): number {
        return SMITHING_BAR_TYPE_VARBIT_ID;
    }

    getBarTypeByItemId(itemId: number): number | undefined {
        this.initializeBarEnumCache();
        return this.barItemIdToType.get(itemId);
    }
}
