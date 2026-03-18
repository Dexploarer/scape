import assert from "assert";

import { MUSIC_UNLOCK_VARPS } from "../../src/shared/vars";
import type { MusicCatalogEntry } from "../src/audio/MusicCatalogService";
import { MusicUnlockService } from "../src/audio/MusicUnlockService";
import { PlayerState } from "../src/game/player";

function createService(entries: MusicCatalogEntry[]): MusicUnlockService {
    const tracksByMidiId = new Map(entries.map((entry) => [entry.trackId, entry]));
    const musicCatalog = {
        getTrackByMidiId(trackId: number) {
            return tracksByMidiId.get(trackId);
        },
        getTracks() {
            return entries;
        },
    } as any;
    return new MusicUnlockService(musicCatalog);
}

(function testUnlockUsesMusicDbVariablePair() {
    const service = createService([
        {
            rowId: 2516,
            trackId: 73,
            trackName: "All's Fairy in Love & War",
            sortName: "All's Fairy in Love & War",
            unlockHint: "",
            unlockVarpIndex: 14,
            unlockBitIndex: 20,
            automaticUnlock: false,
            hidden: false,
        },
    ]);
    const player = new PlayerState(1, 3200, 3200, 0);

    assert.strictEqual(service.isTrackUnlocked(player, 73), false);
    assert.strictEqual(service.unlockTrack(player, 73), true);
    assert.strictEqual(player.getVarpValue(MUSIC_UNLOCK_VARPS[13]), 1 << 20);
    assert.strictEqual(service.isTrackUnlocked(player, 73), true);
})();

(function testTwentySeventhMusicUnlockVarpIsReachable() {
    const service = createService([
        {
            rowId: 9999,
            trackId: 999,
            trackName: "Test Track",
            sortName: "Test Track",
            unlockHint: "",
            unlockVarpIndex: 27,
            unlockBitIndex: 3,
            automaticUnlock: false,
            hidden: false,
        },
    ]);
    const player = new PlayerState(2, 3200, 3200, 0);

    assert.strictEqual(service.unlockTrack(player, 999), true);
    assert.strictEqual(player.getVarpValue(MUSIC_UNLOCK_VARPS[26]), 1 << 3);
})();
