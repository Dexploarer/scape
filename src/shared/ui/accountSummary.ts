import { packWidgetUid } from "./widgetUid";

export const ACCOUNT_SUMMARY_GROUP_ID = 712;
export const ACCOUNT_SUMMARY_PLAYER_NAME_CHILD_ID = 1;
export const ACCOUNT_SUMMARY_CONTENTS_CHILD_ID = 2;
export const ACCOUNT_SUMMARY_CLICK_LAYER_CHILD_ID = 3;

export const ACCOUNT_SUMMARY_PLAYER_NAME_UID = packWidgetUid(
    ACCOUNT_SUMMARY_GROUP_ID,
    ACCOUNT_SUMMARY_PLAYER_NAME_CHILD_ID,
);
export const ACCOUNT_SUMMARY_CONTENTS_UID = packWidgetUid(
    ACCOUNT_SUMMARY_GROUP_ID,
    ACCOUNT_SUMMARY_CONTENTS_CHILD_ID,
);
export const ACCOUNT_SUMMARY_CLICK_LAYER_UID = packWidgetUid(
    ACCOUNT_SUMMARY_GROUP_ID,
    ACCOUNT_SUMMARY_CLICK_LAYER_CHILD_ID,
);
export const ACCOUNT_SUMMARY_ENTRY_LIST_UID = ACCOUNT_SUMMARY_CLICK_LAYER_UID;

// Dynamic account-summary rows are created under 712:3.
export const ACCOUNT_SUMMARY_COLLECTION_LOG_CHILD_INDEX = 6;
export const ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX = 7;

export const SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID = 3970;

export function buildAccountSummarySetTimeScriptArgs(
    totalMinutes: number,
): [number, number, number] {
    const safeMinutes = Math.max(0, Number.isFinite(totalMinutes) ? Math.floor(totalMinutes) : 0);
    return [ACCOUNT_SUMMARY_CONTENTS_UID, ACCOUNT_SUMMARY_CLICK_LAYER_UID, safeMinutes];
}
