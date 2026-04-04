import type { ScriptModule } from "../../../src/game/scripts/types";
import { bankWidgetModule } from "./bankWidgets";

export const bankingModule: ScriptModule = {
    id: "vanilla.banking",
    register(registry, services) {
        registry.registerNpcAction("bank", ({ player, services }) => {
            services.openBank(player, { mode: "bank" });
            services.sendGameMessage(player, "The bank interface opens.");
        });
        registry.registerNpcAction("collect", ({ player, services }) => {
            services.openBank(player, { mode: "collect" });
            services.sendGameMessage(player, "The bank interface opens.");
        });
        registry.registerLocAction("bank", ({ player, services }) => {
            services.openBank(player, { mode: "bank" });
            services.sendGameMessage(player, "The bank interface opens.");
        });

        bankWidgetModule.register(registry, services);
    },
};

export { BankingManager } from "./BankingManager";
export {
    type BankingProvider,
    type BankingProviderServices,
    type BankOperationResult,
    type BankServerUpdate,
    type IfButtonDPayload,
} from "./BankingProvider";
export { registerBankInterfaceHooks, BANK_INTERFACE_ID, type BankOpenData } from "./BankInterfaceHooks";
export {
    WidgetGroup,
    BankMainChild,
    BankSideChild,
    BankVarbit,
    BankVarp,
    BankLimits,
    TAB_SLOT_OFFSET,
    slotToTabIndex,
    getWidgetGroup,
    getWidgetChild,
} from "./bankConstants";
