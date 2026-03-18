import { packWidgetUid } from "./widgetUid";

export const MUSIC_GROUP_ID = 239;

export const MUSIC_JUKEBOX_CHILD_ID = 11;
export const MUSIC_CONTROLS_CHILD_ID = 13;
export const MUSIC_AREA_CHILD_ID = 14;
export const MUSIC_SHUFFLE_CHILD_ID = 15;
export const MUSIC_SINGLE_CHILD_ID = 16;
export const MUSIC_SKIP_CHILD_ID = 17;
export const MUSIC_PLAYLIST_CHILD_ID = 18;

export const MUSIC_NOW_PLAYING_CHILD_ID = 2;
export const MUSIC_NOW_PLAYING_TEXT_CHILD_ID = 4;
export const MUSIC_COUNT_CHILD_ID = 5;

/**
 * IF_SETEVENTS flags for dynamic jukebox rows (ops 1-5).
 * Used by script9290-created children under 239:11.
 */
export const MUSIC_JUKEBOX_ROW_FLAGS = 62;

/**
 * IF_SETEVENTS flags for the now-playing text widget (ops 2-5).
 * script3936 sets "Unlock hint" and playlist ops on 239:4.
 */
export const MUSIC_NOW_PLAYING_FLAGS = 60;

export const MUSIC_NOW_PLAYING_TEXT_UID = packWidgetUid(
    MUSIC_GROUP_ID,
    MUSIC_NOW_PLAYING_TEXT_CHILD_ID,
);
