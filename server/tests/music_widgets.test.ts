import assert from "assert";

import {
    MUSIC_GROUP_ID,
    MUSIC_JUKEBOX_CHILD_ID,
    MUSIC_SKIP_CHILD_ID,
} from "../../src/shared/ui/music";
import { VARP_MUSICPLAY } from "../../src/shared/vars";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { musicWidgetModule } from "../src/game/scripts/modules/musicWidgets";
import { type ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import { createTestScriptServices } from "./scriptServices";

const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
};

type Harness = {
    player: PlayerState;
    runtime: ScriptRuntime;
    scheduler: ScriptScheduler;
    playedTracks: Array<{ trackId: number; trackName?: string }>;
    skipState: { count: number };
    sentVarps: Array<{ varpId: number; value: number }>;
};

function createHarness(): Harness {
    const player = new PlayerState(1, 3200, 3200, 0);
    const registry = new ScriptRegistry();
    const scheduler = new ScriptScheduler();
    const playedTracks: Array<{ trackId: number; trackName?: string }> = [];
    const skipState = { count: 0 };
    const sentVarps: Array<{ varpId: number; value: number }> = [];
    const services: ScriptServices = createTestScriptServices();

    services.logger = silentLogger;
    services.playSong = (_player, trackId, trackName) => {
        playedTracks.push({ trackId, trackName });
    };
    services.sendVarp = (_player, varpId, value) => {
        sentVarps.push({ varpId, value });
    };
    services.getMusicTrackId = (trackName) => (trackName === "All's Fairy in Love & War" ? 73 : -1);
    services.getMusicTrackBySlot = (slot) =>
        slot === 3
            ? {
                  rowId: 2516,
                  trackId: 73,
                  trackName: "All's Fairy in Love & War",
              }
            : undefined;
    services.skipMusicTrack = () => {
        skipState.count++;
        return true;
    };

    const runtime = new ScriptRuntime({ registry, scheduler, services });
    runtime.loadModule(musicWidgetModule);

    return { player, runtime, scheduler, playedTracks, skipState, sentVarps };
}

(function testDynamicMusicListClickPlaysSelectedTrack() {
    const harness = createHarness();

    harness.runtime.queueWidgetAction({
        tick: 1,
        player: harness.player,
        widgetId: (MUSIC_GROUP_ID << 16) | MUSIC_JUKEBOX_CHILD_ID,
        groupId: MUSIC_GROUP_ID,
        childId: 3,
        slot: 3,
        opId: 1,
    });
    harness.scheduler.process(1);

    assert.deepStrictEqual(harness.playedTracks, [
        {
            trackId: 73,
            trackName: "All's Fairy in Love & War",
        },
    ]);
    assert.strictEqual(harness.player.getVarpValue(VARP_MUSICPLAY), 2);
    assert.deepStrictEqual(harness.sentVarps, [{ varpId: VARP_MUSICPLAY, value: 2 }]);
})();

(function testFallbackPlayOptionStillUsesTrackNameLookup() {
    const harness = createHarness();

    harness.runtime.queueWidgetAction({
        tick: 1,
        player: harness.player,
        widgetId: 0,
        groupId: MUSIC_GROUP_ID,
        childId: 0,
        option: "Play",
        target: "<col=ff9040>All's Fairy in Love & War</col>",
    });
    harness.scheduler.process(1);

    assert.deepStrictEqual(harness.playedTracks, [
        {
            trackId: 73,
            trackName: "All's Fairy in Love & War",
        },
    ]);
    assert.strictEqual(harness.player.getVarpValue(VARP_MUSICPLAY), 2);
})();

(function testSkipButtonOnlyDispatchesInShuffleMode() {
    const harness = createHarness();

    harness.runtime.queueWidgetAction({
        tick: 1,
        player: harness.player,
        widgetId: (MUSIC_GROUP_ID << 16) | MUSIC_SKIP_CHILD_ID,
        groupId: MUSIC_GROUP_ID,
        childId: MUSIC_SKIP_CHILD_ID,
        opId: 1,
    });
    harness.scheduler.process(1);
    assert.strictEqual(harness.skipState.count, 0);

    harness.player.setVarpValue(VARP_MUSICPLAY, 1);
    harness.runtime.queueWidgetAction({
        tick: 2,
        player: harness.player,
        widgetId: (MUSIC_GROUP_ID << 16) | MUSIC_SKIP_CHILD_ID,
        groupId: MUSIC_GROUP_ID,
        childId: MUSIC_SKIP_CHILD_ID,
        opId: 1,
    });
    harness.scheduler.process(2);
    assert.strictEqual(harness.skipState.count, 1);
})();
