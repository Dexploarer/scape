import {
    ACCOUNT_SUMMARY_ENTRY_LIST_UID,
    ACCOUNT_SUMMARY_GROUP_ID,
    ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX,
    SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
    buildAccountSummarySetTimeScriptArgs,
} from "../../../../../src/shared/ui/accountSummary";
import { VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME } from "../../../../../src/shared/vars";
import { getAccountSummaryTimeMinutes } from "../../accountSummaryTime";
import { type ScriptModule, type WidgetActionEvent } from "../types";

function resolveAccountSummaryEntryIndex(event: WidgetActionEvent): number {
    const slotVal = event.slot ?? -1;
    if (slotVal >= 0 && slotVal !== 65535) {
        return slotVal;
    }
    return event.childId ?? -1;
}

export const accountSummaryWidgetsModule: ScriptModule = {
    id: "content.account-summary-widgets",
    register(registry, services) {
        registry.registerWidgetAction({
            widgetId: ACCOUNT_SUMMARY_ENTRY_LIST_UID,
            handler: (event: WidgetActionEvent) => {
                if (event.groupId !== ACCOUNT_SUMMARY_GROUP_ID) return;
                if (
                    resolveAccountSummaryEntryIndex(event) !== ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX
                ) {
                    return;
                }

                const player = event.player;
                const nextValue =
                    player.getVarbitValue(VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME) === 1 ? 0 : 1;

                player.setVarbitValue(VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME, nextValue);
                services.queueVarbit?.(
                    player.id,
                    VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME,
                    nextValue,
                );
                services.queueWidgetEvent?.(player.id, {
                    action: "run_script",
                    scriptId: SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
                    args: buildAccountSummarySetTimeScriptArgs(
                        getAccountSummaryTimeMinutes(player),
                    ),
                });
            },
        });
    },
};
