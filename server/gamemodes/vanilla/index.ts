import path from "path";

import type { BankingProviderServices } from "./banking/BankingProvider";
import type { PlayerState } from "../../src/game/player";
import type { ScriptManifestEntry } from "../../src/game/scripts/manifest";
import type { ScriptModule } from "../../src/game/scripts/types";
import type { GamemodeBridge, GamemodeDefinition, GamemodeInitContext, HandshakeBridge } from "../../src/game/gamemodes/GamemodeDefinition";
import { BankingManager } from "./banking";
import { registerBankInterfaceHooks } from "./banking";

const DEFAULT_SPAWN = { x: 3222, y: 3218, level: 0 };

export class VanillaGamemode implements GamemodeDefinition {
    readonly id = "vanilla";
    readonly name = "Vanilla";

    private bankingManager: BankingManager | undefined;

    getSkillXpMultiplier(_player: PlayerState): number {
        return 1;
    }

    getDropRateMultiplier(_player: PlayerState | undefined): number {
        return 1;
    }

    isDropBoostEligible(_entry: { dropBoostEligible?: boolean }): boolean {
        return false;
    }

    transformDropItemId(_npcTypeId: number, itemId: number, _player: PlayerState | undefined): number {
        return itemId;
    }

    hasInfiniteRunEnergy(_player: PlayerState): boolean {
        return false;
    }

    canInteract(_player: PlayerState): boolean {
        return true;
    }

    initializePlayer(_player: PlayerState): void {}

    serializePlayerState(_player: PlayerState): Record<string, unknown> | undefined {
        return undefined;
    }

    deserializePlayerState(_player: PlayerState, _data: Record<string, unknown>): void {}

    onNpcKill(_playerId: number, _npcTypeId: number): void {}

    isTutorialActive(_player: PlayerState): boolean {
        return false;
    }

    getSpawnLocation(_player: PlayerState): { x: number; y: number; level: number } {
        return DEFAULT_SPAWN;
    }

    onPlayerHandshake(_player: PlayerState, _bridge: HandshakeBridge): void {}

    onPlayerLogin(_player: PlayerState, _bridge: GamemodeBridge): void {}

    getDisplayName(_player: PlayerState, baseName: string, _isAdmin: boolean): string {
        return baseName;
    }

    getChatPlayerType(_player: PlayerState, _isAdmin: boolean): number {
        return 0;
    }

    getGamemodeServices(): Record<string, unknown> {
        return {
            banking: this.bankingManager,
        };
    }

    getScriptManifest(): ScriptManifestEntry[] {
        const BANKING_DIR = path.resolve(__dirname, "banking");
        const loadModule = (relativePath: string, exportName: string): (() => ScriptModule) => {
            const resolved = path.resolve(BANKING_DIR, relativePath);
            return () => {
                const mod = require(resolved);
                return mod[exportName] as ScriptModule;
            };
        };
        return [
            {
                id: "vanilla.banking",
                load: loadModule("index", "bankingModule"),
                watch: [
                    path.resolve(BANKING_DIR, "index.ts"),
                    path.resolve(BANKING_DIR, "bankWidgets.ts"),
                    path.resolve(BANKING_DIR, "BankInterfaceHooks.ts"),
                    path.resolve(BANKING_DIR, "BankingManager.ts"),
                    path.resolve(BANKING_DIR, "bankConstants.ts"),
                ],
            },
        ];
    }

    initialize(context: GamemodeInitContext): void {
        const bankingServices = context.serverServices.bankingServices as BankingProviderServices | undefined;
        if (bankingServices) {
            this.bankingManager = new BankingManager(bankingServices);

            const interfaceService = bankingServices.getInterfaceService();
            if (interfaceService) {
                registerBankInterfaceHooks(interfaceService);
            }
        }
    }
}

export function createGamemode(): GamemodeDefinition {
    return new VanillaGamemode();
}
