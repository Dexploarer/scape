import type { PlayerState } from "../player";

export interface PrayerTickResult {
    prayerDepleted?: boolean;
}

export interface PrayerSystemProvider {
    processPlayer(player: PlayerState): PrayerTickResult | undefined;
}
