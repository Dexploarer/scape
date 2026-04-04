import type { BankEntry, PlayerState } from "../../../src/game/player";
import type { GamemodeServerServices } from "../../../src/game/gamemodes/GamemodeDefinition";

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

/**
 * Services required by BankingManager. Extends GamemodeServerServices
 * with banking-specific snapshot methods.
 */
export interface BankingProviderServices extends GamemodeServerServices {
    queueBankSnapshot(playerId: number, payload: BankServerUpdate): void;
    sendBankSnapshot(playerId: number, payload: BankServerUpdate): void;
}
