const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Official client parity: LocalDate.ofEpochDay(joinRuneDay + 11745).
export const RUNEDAY_EPOCH_DAY_OFFSET = 11745;

export function getRuneDay(nowMs: number = Date.now()): number {
    if (!Number.isFinite(nowMs)) {
        return 0;
    }
    return Math.floor(nowMs / MS_PER_DAY) - RUNEDAY_EPOCH_DAY_OFFSET;
}
