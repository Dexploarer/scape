import {
    ACCOUNT_SUMMARY_GROUP_ID,
    SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
    buildAccountSummarySetTimeScriptArgs,
} from "../../../src/shared/ui/accountSummary";
import { getAccountSummaryTimeMinutes } from "../game/accountSummaryTime";
import type { PlayerState } from "../game/player";
import type { WidgetAction } from "../widgets/WidgetManager";

export interface AccountSummaryServices {
    queueWidgetEvent: (playerId: number, action: WidgetAction) => void;
    isWidgetGroupOpenInLedger: (playerId: number, groupId: number) => boolean;
}

export class AccountSummaryTracker {
    private readonly lastMinutesByPlayer = new Map<number, number>();

    constructor(private readonly services: AccountSummaryServices) {}

    clearPlayer(playerIdRaw: number): void {
        const playerId = playerIdRaw;
        if (playerId < 0) return;
        this.lastMinutesByPlayer.delete(playerId);
    }

    syncPlayer(player: PlayerState, nowMs: number = Date.now(), force: boolean = false): void {
        const playerId = player.id;
        if (!this.services.isWidgetGroupOpenInLedger(playerId, ACCOUNT_SUMMARY_GROUP_ID)) {
            this.lastMinutesByPlayer.delete(playerId);
            return;
        }

        const minutes = getAccountSummaryTimeMinutes(player, nowMs);
        if (!force && this.lastMinutesByPlayer.get(playerId) === minutes) {
            return;
        }

        this.lastMinutesByPlayer.set(playerId, minutes);
        this.services.queueWidgetEvent(playerId, {
            action: "run_script",
            scriptId: SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
            args: buildAccountSummarySetTimeScriptArgs(minutes),
        });
    }
}
