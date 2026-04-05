import type { PrayerHeadIcon, PrayerName } from "../../../../src/rs/prayer/prayers";

/**
 * Prayer-related fields for a player. Composed into PlayerState
 * to co-locate prayer data.
 */
export class PlayerPrayerState {
    activePrayers: Set<PrayerName> = new Set();
    quickPrayers: Set<PrayerName> = new Set();
    quickPrayersEnabled: boolean = false;
    drainAccumulator: number = 0;
    headIcon: PrayerHeadIcon | null = null;
}
