import assert from "assert";

import {
    MUSIC_GROUP_ID,
    MUSIC_JUKEBOX_CHILD_ID,
    MUSIC_JUKEBOX_ROW_FLAGS,
    MUSIC_NOW_PLAYING_FLAGS,
    MUSIC_NOW_PLAYING_TEXT_UID,
} from "../../src/shared/ui/music";
import { VARP_MUSICPLAY, VARP_MUSIC_CURRENT_TRACK } from "../../src/shared/vars";
import { PlayerState } from "../src/game/player";
import {
    type MusicCatalogTrackRef,
    type PlayerCollectionRef,
    SoundManager,
    type SoundManagerServices,
} from "../src/network/managers/SoundManager";

type SentMessage = {
    context: string;
    message: any;
};

function createHarness(
    opts: {
        regionTrack?: { trackId: number; trackName: string };
        catalogTracks?: MusicCatalogTrackRef[];
        randomValue?: number;
        unlockedTrackIds?: number[];
    } = {},
): {
    manager: SoundManager;
    player: PlayerState;
    sentMessages: SentMessage[];
    clientScripts: Array<{ playerId: number; scriptId: number; args: (number | string)[] }>;
} {
    const player = new PlayerState(1, 3200, 3200, 0);
    const socket = { readyState: 1, send: () => {} };
    const sentMessages: SentMessage[] = [];
    const clientScripts: Array<{ playerId: number; scriptId: number; args: (number | string)[] }> =
        [];
    const catalogTracks = opts.catalogTracks ?? [];
    const unlockedTrackIds = opts.unlockedTrackIds;

    const players: PlayerCollectionRef = {
        forEach(callback) {
            callback(socket, player);
        },
        getSocketByPlayerId(playerId) {
            return playerId === player.id ? socket : undefined;
        },
    };

    const services: SoundManagerServices = {
        getPlayers: () => players,
        getNpcSoundLookup: () => undefined,
        getMusicRegionService: () =>
            opts.regionTrack
                ? {
                      getMusicForRegion: () => opts.regionTrack,
                  }
                : undefined,
        getMusicCatalogService: () => ({
            getBaseTrackCount: () => catalogTracks.length,
            getBaseListTrackBySlot: (slot) => catalogTracks[slot],
            getTrackByMidiId: (trackId) => catalogTracks.find((track) => track.trackId === trackId),
            getTrackByName: (trackName) =>
                catalogTracks.find((track) => track.trackName === trackName),
            getTrackByRowId: (rowId) => catalogTracks.find((track) => track.rowId === rowId),
        }),
        getMusicUnlockService: () => ({
            isTrackUnlocked: (_player, trackId) =>
                unlockedTrackIds ? unlockedTrackIds.includes(trackId) : true,
            unlockTrack: () => false,
            getUnlockVarpId: () => undefined,
            shouldShowUnlockMessage: () => false,
            initializeDefaults: () => {},
        }),
        getNpcTypeLoader: () => undefined,
        getDbRepository: () => ({
            getRows: () => [],
        }),
        getWeaponData: () => new Map(),
        ensureEquipArray: () => [],
        getCurrentTick: () => 0,
        random: () => opts.randomValue ?? 0,
        getVarpMusicPlay: () => VARP_MUSICPLAY,
        getVarpMusicCurrentTrack: () => VARP_MUSIC_CURRENT_TRACK,
        sendWithGuard: (_sock, message, context) => {
            sentMessages.push({ context, message });
        },
        encodeMessage: (message) => message as unknown as Uint8Array,
        queueChatMessage: () => {},
        queueClientScript: (playerId, scriptId, ...args) => {
            clientScripts.push({ playerId, scriptId, args });
        },
        queueVarp: () => {},
        broadcastToNearby: () => {},
        withDirectSendBypass: (_context, fn) => fn(),
        getNpcCombatDefs: () => undefined,
        getNpcCombatDefaults: () => ({ deathSound: 0 }),
        loadNpcCombatDefs: () => {},
        log: () => {},
    };

    return {
        manager: new SoundManager(services),
        player,
        sentMessages,
        clientScripts,
    };
}

(function testPlaySongTargetsCurrentMusicWidgets() {
    const { manager, player, sentMessages } = createHarness({
        catalogTracks: [{ rowId: 2516, trackId: 321, trackName: "Test Track" }],
    });

    manager.playSongForPlayer(player, 321, "Test Track");

    assert.strictEqual(player.getLastPlayedMusicTrackId(), 321);
    assert.strictEqual(player.getVarpValue(VARP_MUSIC_CURRENT_TRACK), 2516);

    const varpUpdate = sentMessages.find(
        ({ context, message }) =>
            context === "varp" && message?.payload?.varpId === VARP_MUSIC_CURRENT_TRACK,
    );
    assert.deepStrictEqual(varpUpdate?.message, {
        type: "varp",
        payload: {
            varpId: VARP_MUSIC_CURRENT_TRACK,
            value: 2516,
        },
    });

    const widgetUpdate = sentMessages.find(({ context }) => context === "if_settext");
    assert.deepStrictEqual(widgetUpdate?.message, {
        type: "widget",
        payload: {
            action: "set_text",
            uid: MUSIC_NOW_PLAYING_TEXT_UID,
            text: "Test Track",
        },
    });
})();

(function testAreaModeResumePlaysCurrentRegionTrackImmediately() {
    const { manager, player, sentMessages } = createHarness({
        regionTrack: { trackId: 777, trackName: "Area Song" },
        catalogTracks: [{ rowId: 9001, trackId: 777, trackName: "Area Song" }],
    });

    manager.handleMusicModeChange(player, 1, 0);

    assert.strictEqual(player.getLastPlayedMusicTrackId(), 777);
    assert.strictEqual(player.getVarpValue(VARP_MUSIC_CURRENT_TRACK), 9001);
    assert.ok(
        sentMessages.some(
            ({ context, message }) => context === "play_song" && message?.payload?.trackId === 777,
        ),
        "switching back to area mode should play the current region track",
    );

    const messageCount = sentMessages.length;
    manager.handleMusicModeChange(player, 2, 0);
    assert.strictEqual(
        sentMessages.length,
        messageCount,
        "area-mode resume should not replay the same region track",
    );
})();

(function testMusicTabOpenResendsNowPlayingState() {
    const { manager, player, sentMessages, clientScripts } = createHarness({
        catalogTracks: [{ rowId: 2516, trackId: 321, trackName: "Test Track" }],
    });

    manager.playSongForPlayer(player, 321, "Test Track");
    sentMessages.splice(0, sentMessages.length);
    clientScripts.splice(0, clientScripts.length);

    player.widgets.open(MUSIC_GROUP_ID, { modal: false });
    manager.syncMusicInterfaceForPlayer(player);

    assert.ok(
        sentMessages.some(
            ({ context, message }) =>
                context === "if_setevents" &&
                message?.payload?.action === "set_flags_range" &&
                message?.payload?.uid === ((MUSIC_GROUP_ID << 16) | MUSIC_JUKEBOX_CHILD_ID) &&
                message?.payload?.fromSlot === 0 &&
                message?.payload?.toSlot === 0 &&
                message?.payload?.flags === MUSIC_JUKEBOX_ROW_FLAGS,
        ),
        "opening the music tab should enable transmit flags for jukebox rows",
    );
    assert.ok(
        sentMessages.some(
            ({ context, message }) =>
                context === "if_setevents" &&
                message?.payload?.action === "set_flags" &&
                message?.payload?.uid === MUSIC_NOW_PLAYING_TEXT_UID &&
                message?.payload?.flags === MUSIC_NOW_PLAYING_FLAGS,
        ),
        "opening the music tab should enable transmit flags for now playing actions",
    );
    assert.ok(
        sentMessages.some(
            ({ context, message }) =>
                context === "varp" &&
                message?.payload?.varpId === VARP_MUSIC_CURRENT_TRACK &&
                message?.payload?.value === 2516,
        ),
        "opening the music tab should resend the current music row varp",
    );
    assert.ok(
        sentMessages.some(
            ({ context, message }) =>
                context === "if_settext" && message?.payload?.text === "Test Track",
        ),
        "opening the music tab should resend the now playing text",
    );
    assert.deepStrictEqual(clientScripts, [{ playerId: 1, scriptId: 3932, args: [] }]);
})();

(function testSkipTrackOnlyAdvancesInShuffleMode() {
    const { manager, player, sentMessages } = createHarness({
        catalogTracks: [
            { rowId: 1001, trackId: 321, trackName: "Current Track" },
            { rowId: 1002, trackId: 654, trackName: "Next Track" },
            { rowId: 1003, trackId: 987, trackName: "Locked Track" },
        ],
        unlockedTrackIds: [321, 654],
        randomValue: 0,
    });

    manager.playSongForPlayer(player, 321, "Current Track");
    sentMessages.splice(0, sentMessages.length);

    assert.strictEqual(manager.skipTrackForPlayer(player), false);
    assert.strictEqual(sentMessages.length, 0);

    player.setVarpValue(VARP_MUSICPLAY, 1);
    assert.strictEqual(manager.skipTrackForPlayer(player), true);
    assert.strictEqual(player.getLastPlayedMusicTrackId(), 654);
    assert.strictEqual(player.getVarpValue(VARP_MUSIC_CURRENT_TRACK), 1002);
    assert.ok(
        sentMessages.some(
            ({ context, message }) => context === "play_song" && message?.payload?.trackId === 654,
        ),
        "shuffle skip should play another unlocked track",
    );
})();

(function testUnmutingReplaysCurrentTrack() {
    const { manager, player, sentMessages } = createHarness({
        catalogTracks: [{ rowId: 2516, trackId: 321, trackName: "Test Track" }],
    });

    player.setVarpValue(VARP_MUSIC_CURRENT_TRACK, 2516);
    player.setLastPlayedMusicTrackId(321);

    manager.handleMusicVolumeChange(player, 0, 75);

    assert.ok(
        sentMessages.some(
            ({ context, message }) => context === "play_song" && message?.payload?.trackId === 321,
        ),
        "unmuting should replay the current track so muted requests become audible",
    );
})();
