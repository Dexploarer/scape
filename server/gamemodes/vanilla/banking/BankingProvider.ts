import type { BankEntry, PlayerState } from "../../../src/game/player";
import type { InterfaceService } from "../../../src/widgets/InterfaceService";

export interface BankOperationResult {
    ok: boolean;
    message?: string;
}

export interface BankServerUpdate {
    kind: "snapshot";
    capacity: number;
    slots: Array<{
        slot: number;
        itemId: number;
        quantity: number;
        placeholder: boolean;
        filler: boolean;
        tab: number;
    }>;
}

export interface IfButtonDPayload {
    sourceWidgetId: number;
    sourceSlot: number;
    sourceItemId: number;
    targetWidgetId: number;
    targetSlot: number;
    targetItemId: number;
}

export interface BankingProvider {
    openBank(player: PlayerState, opts?: { mode?: "bank" | "collect" }): void;
    depositInventory(player: PlayerState, tab?: number): boolean;
    depositEquipment(player: PlayerState, tab?: number): boolean;
    depositItem(
        player: PlayerState,
        slot: number,
        quantity: number,
        itemIdHint?: number,
        tab?: number,
    ): BankOperationResult;
    withdraw(
        player: PlayerState,
        slot: number,
        quantity: number,
        opts?: { overrideNoted?: boolean },
    ): BankOperationResult;
    addItemToBank(player: PlayerState, itemId: number, quantity: number, tab?: number): boolean;
    getBankEntryAtClientSlot(
        player: PlayerState,
        clientSlot: number,
    ): BankEntry | undefined;
    moveBankSlot(
        player: PlayerState,
        from: number,
        to: number,
        opts?: { insert?: boolean; tab?: number },
    ): boolean;
    handleIfButtonD(player: PlayerState, payload: IfButtonDPayload): void;
    queueBankSnapshot(player: PlayerState): void;
    sendBankTabVarbits(player: PlayerState): void;
    buildBankSlotMapping(player: PlayerState): number[];
}

export interface BankingProviderServices {
    getInventory(player: PlayerState): Array<{ itemId: number; quantity: number }>;
    getEquipArray(player: PlayerState): number[];
    getEquipQtyArray(player: PlayerState): number[];
    addItemToInventory(
        player: PlayerState,
        itemId: number,
        quantity: number,
    ): { slot: number; added: number };
    sendInventorySnapshot(playerId: number): void;
    refreshAppearance(player: PlayerState): void;
    refreshCombatWeapon(player: PlayerState): {
        categoryChanged: boolean;
        weaponItemChanged: boolean;
    };
    sendAppearanceUpdate(playerId: number): void;
    queueCombatSnapshot(
        playerId: number,
        category: number,
        weaponItemId: number,
        autoRetaliate: boolean,
        styleSlot: number,
        activePrayers: string[],
        combatSpellId?: number,
    ): void;
    queueChatMessage(opts: {
        messageType: string;
        text: string;
        targetPlayerIds: number[];
    }): void;
    queueVarbit(playerId: number, varbitId: number, value: number): void;
    queueBankSnapshot(playerId: number, payload: BankServerUpdate): void;
    sendBankSnapshot(playerId: number, payload: BankServerUpdate): void;
    queueWidgetEvent(playerId: number, event: any): void;
    getObjType(itemId: number): any;
    getMainmodalUid(displayMode: number): number;
    getInventoryTabUid(displayMode: number): number;
    getInterfaceService(): InterfaceService | undefined;
    logger: {
        debug(message: string, ...args: any[]): void;
        info(message: string, ...args: any[]): void;
        warn(message: string, ...args: any[]): void;
    };
}
