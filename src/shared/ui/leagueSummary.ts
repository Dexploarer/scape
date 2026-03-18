import { packWidgetUid } from "./widgetUid";

export const LEAGUE_SUMMARY_GROUP_ID = 529;
export const LEAGUE_SUMMARY_STATS_CONTENT_CHILD_ID = 23;
export const LEAGUE_SUMMARY_STATS_CONTENT_UID = packWidgetUid(
    LEAGUE_SUMMARY_GROUP_ID,
    LEAGUE_SUMMARY_STATS_CONTENT_CHILD_ID,
);

// script7719 builds the first stats row ("Account Age") under 529:23 as:
//   child 0 = background, child 1 = label, child 2 = value.
export const LEAGUE_SUMMARY_ACCOUNT_AGE_VALUE_CHILD_INDEX = 2;

export const SCRIPT_CC_TEXT_SWAPPER_ID = 599;

export function buildLeagueSummaryAccountAgeArgs(text: string): [number, number, string] {
    return [LEAGUE_SUMMARY_STATS_CONTENT_UID, LEAGUE_SUMMARY_ACCOUNT_AGE_VALUE_CHILD_INDEX, text];
}
