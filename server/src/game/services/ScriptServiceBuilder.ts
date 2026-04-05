import type { ScriptServices } from "../scripts/types";
import type { PlayerState } from "../player";
import type { NpcState } from "../npc";

/**
 * Dependencies required to build the ScriptServices object.
 * These are provided by WSServer (or any future host) and represent
 * the capabilities that scripts can access.
 *
 * This interface decouples the service wiring from WSServer's class
 * by declaring exactly what capabilities the builder needs.
 */
export interface ScriptServiceDependencies {
    // Data loaders
    getDbRepository: () => any;
    getEnumTypeLoader: () => any;
    getStructTypeLoader: () => any;
    getIdkTypeLoader: () => any;
    getObjType: (id: number) => any;
    getLocDefinition: (id: number) => any;
    getDoorManager: () => any;

    // Tick
    getCurrentTick: () => number;

    // Messaging
    sendGameMessage: (player: PlayerState, text: string) => void;
    queueNotification: (playerId: number, payload: any) => void;
    queueChatMessage: (request: any) => void;

    // Variables
    queueVarp: (playerId: number, varpId: number, value: number) => void;
    queueVarbit: (playerId: number, varbitId: number, value: number) => void;

    // Inventory
    consumeItem: (player: PlayerState, slotIndex: number) => boolean;
    getInventory: (player: PlayerState) => Array<{ itemId: number; quantity: number }>;
    addItemToInventory: (player: PlayerState, itemId: number, qty: number) => any;
    setInventorySlot: (player: PlayerState, slotIndex: number, itemId: number, qty: number) => void;
    snapshotInventory: (player: PlayerState) => void;
    findOwnedItemLocation: (player: PlayerState, itemId: number) => any;
    collectCarriedItemIds: (player: PlayerState) => number[];
    findInventorySlotWithItem: (player: PlayerState, itemId: number) => number | undefined;
    canStoreItem: (player: PlayerState, itemId: number) => boolean;
    playerHasItem: (player: PlayerState, itemId: number) => boolean;
    hasInventorySlot: (player: PlayerState) => boolean;
    takeInventoryItems: (player: PlayerState, inputs: any) => any;
    restoreInventoryRemovals: (player: PlayerState, removed: any) => void;
    restoreInventoryItems: (player: PlayerState, itemId: number, removed: any) => void;

    // Equipment
    getEquipArray: (player: PlayerState) => number[];
    getEquippedItem: (player: PlayerState, slot: number) => number;
    unequipItem: (player: PlayerState, slot: number) => boolean;

    // Skills
    awardSkillXp: (player: PlayerState, skillId: number, xp: number) => void;

    // Animation & Sound
    queuePlayerSeq: (player: PlayerState, seqId: number, delay?: number) => void;
    enqueueSpotAnimation: (event: any) => void;
    playLocGraphic: (opts: any) => void;
    playLocSound: (opts: any) => void;
    playAreaSound: (opts: any) => void;
    playSong: (player: PlayerState, trackId: number, trackName?: string) => void;
    skipMusicTrack: (player: PlayerState) => boolean;
    getMusicTrackIdByName: (trackName: string) => number;
    getMusicTrackBySlot: (slot: number) => any;
    sendSound: (player: PlayerState, soundId: number, opts?: any) => void;
    enqueueSoundBroadcast: (soundId: number, x: number, y: number, level: number) => void;

    // Appearance
    refreshAppearanceKits: (player: PlayerState) => void;
    queueAppearanceSnapshot: (player: PlayerState) => void;
    savePlayerSnapshot: (player: PlayerState) => void;
    logoutPlayer: (player: PlayerState, reason?: string) => void;

    // Dialog & Interface
    openDialog: (player: PlayerState, request: any) => void;
    openDialogOptions: (player: PlayerState, options: any) => void;
    closeDialog: (player: PlayerState, dialogId?: string) => void;
    closeInterruptibleInterfaces: (player: PlayerState) => void;
    queueWidgetEvent: (playerId: number, event: any) => void;
    queueClientScript: (playerId: number, scriptId: number, ...args: any[]) => void;
    getInterfaceService: () => any;
    openRemainingTabs: (player: PlayerState) => void;
    openSubInterface: (player: PlayerState, targetUid: number, groupId: number, type?: number, opts?: any) => void;
    closeSubInterface: (player: PlayerState, targetUid: number, groupId?: number) => void;
    closeModal: (player: PlayerState) => void;

    // Movement
    teleportPlayer: (player: PlayerState, x: number, y: number, level: number, forceRebuild?: boolean) => void;
    teleportToInstance: (player: PlayerState, x: number, y: number, level: number, templateChunks: any, extraLocs?: any) => void;
    requestTeleportAction: (player: PlayerState, request: any) => { ok: boolean; reason?: string };
    queueForcedMovement: (player: PlayerState, params: any) => void;
    getPathService: () => any;

    // Location
    emitLocChange: (oldId: number, newId: number, tile: any, level: number, opts?: any) => void;
    sendLocChangeToPlayer: (player: PlayerState, oldId: number, newId: number, tile: any, level: number) => void;
    spawnLocForPlayer: (player: PlayerState, locId: number, tile: any, level: number, shape: number, rotation: number) => void;

    // Combat
    applyPrayers: (player: PlayerState, prayers: any[]) => any;
    setCombatSpell: (player: PlayerState, spellId: number | null) => void;
    queueCombatState: (player: PlayerState) => void;
    requestAction: (player: PlayerState, request: any, currentTick: any) => any;
    getNpc: (id: number) => NpcState | undefined;
    isPlayerStunned: (player: PlayerState) => boolean;
    isPlayerInCombat: (player: PlayerState) => boolean;
    applyPlayerHitsplat: (player: PlayerState, style: number, damage: number, tick: number) => any;
    stunPlayer: (player: PlayerState, ticks: number) => void;
    scheduleAction: (playerId: number, request: any, tick: number) => any;
    clearPlayerFaceTarget: (player: PlayerState) => void;

    // NPC
    spawnNpc: (config: any) => NpcState | undefined;
    removeNpc: (npcId: number) => boolean;
    queueNpcForcedChat: (npc: NpcState, text: string) => void;
    queueNpcSeq: (npc: NpcState, seqId: number) => void;
    faceNpcToPlayer: (npc: NpcState, player: PlayerState) => void;

    // Collection log
    sendCollectionLogSnapshot: (player: PlayerState) => void;
    openCollectionLog: (player: PlayerState) => void;
    openCollectionOverview: (player: PlayerState) => void;
    populateCollectionLogCategories: (player: PlayerState, tabIndex: number) => void;

    // Gathering
    gathering: any;
    getWoodcuttingTree: (locId: number) => any;
    getMiningRock: (locId: number) => any;
    getFishingSpot: (npcTypeId: number) => any;
    isAdjacentToLoc: (player: PlayerState, locId: number, tile: any, level: number) => boolean;
    isAdjacentToNpc: (player: PlayerState, npc: NpcState) => boolean;
    faceGatheringTarget: (player: PlayerState, tile: any) => void;
    isFiremakingTileBlocked: (tile: any, level: number) => boolean;
    lightFire: (params: any) => any;
    playerHasTinderbox: (player: PlayerState) => boolean;
    consumeFiremakingLog: (player: PlayerState, logId: number, slotIndex?: number) => number | undefined;
    walkPlayerAwayFromFire: (player: PlayerState, fireTile: any) => void;
    getCookingRecipeByRawItemId: (itemId: number) => any;

    // Production
    production: import("../scripts/serviceInterfaces").ProductionServiceFacade;

    // Followers
    followers: {
        summonFollowerFromItem: (player: PlayerState, itemId: number, npcTypeId: number) => any;
        pickupFollower: (player: PlayerState, npcId: number) => any;
        metamorphFollower: (player: PlayerState, npcId: number) => any;
        callFollower: (player: PlayerState) => any;
        despawnFollowerForPlayer: (playerId: number, clearPersistentState?: boolean) => boolean;
    };

    // Sailing
    sailing: {
        initSailingInstance: (player: PlayerState) => void;
        disposeSailingInstance: (player: PlayerState) => void;
        teleportToWorldEntity: (...args: any[]) => void;
        sendWorldEntity: (...args: any[]) => void;
        removeWorldEntity: (playerId: number, entityIndex: number) => void;
        queueWorldEntityPosition: (playerId: number, entityIndex: number, position: any) => void;
        setWorldEntityPosition: (playerId: number, entityIndex: number, position: any) => void;
        queueWorldEntityMask: (playerId: number, entityIndex: number, mask: any) => void;
        buildSailingDockedCollision: () => void;
    };
}

/**
 * Builds a ScriptServices object from the provided dependencies.
 *
 * This function extracts the massive services object literal from WSServer
 * into a standalone builder, making it possible to:
 * 1. Test service wiring independently
 * 2. Replace individual service implementations without touching WSServer
 * 3. Eventually split into per-domain service classes
 */
export function buildScriptServices(deps: ScriptServiceDependencies): ScriptServices {
    return {
        // Data loaders
        getDbRepository: deps.getDbRepository,
        getEnumTypeLoader: deps.getEnumTypeLoader,
        getStructTypeLoader: deps.getStructTypeLoader,
        getIdkTypeLoader: deps.getIdkTypeLoader,
        getObjType: deps.getObjType,
        getLocDefinition: deps.getLocDefinition,
        doorManager: deps.getDoorManager(),

        // System
        getCurrentTick: deps.getCurrentTick,

        // Messaging
        sendGameMessage: deps.sendGameMessage,
        queueNotification: deps.queueNotification,

        // Variables
        sendVarp: (player, varpId, value) => deps.queueVarp(player.id, varpId, value),
        sendVarbit: (player, varbitId, value) => deps.queueVarbit(player.id, varbitId, value),
        queueVarp: deps.queueVarp,
        queueVarbit: deps.queueVarbit,

        // Inventory
        consumeItem: deps.consumeItem,
        getInventoryItems: (player) =>
            deps.getInventory(player).map((entry, idx) => ({
                slot: idx,
                itemId: entry ? entry.itemId : -1,
                quantity: entry ? entry.quantity : 0,
            })),
        addItemToInventory: deps.addItemToInventory,
        setInventorySlot: deps.setInventorySlot,
        snapshotInventory: deps.snapshotInventory,
        snapshotInventoryImmediate: deps.snapshotInventory,
        findOwnedItemLocation: deps.findOwnedItemLocation,
        collectCarriedItemIds: deps.collectCarriedItemIds,
        findInventorySlotWithItem: deps.findInventorySlotWithItem,
        canStoreItem: deps.canStoreItem,
        playerHasItem: deps.playerHasItem,
        hasInventorySlot: deps.hasInventorySlot,

        // Equipment
        getEquippedItem: deps.getEquippedItem,
        getEquipArray: deps.getEquipArray,
        unequipItem: deps.unequipItem,

        // Skills
        addSkillXp: deps.awardSkillXp,
        getSkill: (player, skillId) => {
            const skill = player.getSkill(skillId);
            return { baseLevel: skill.baseLevel, boost: skill.boost, xp: skill.xp };
        },

        // Animation & Sound
        playPlayerSeq: (player, seqId, delay = 0) => deps.queuePlayerSeq(player, seqId, delay),
        playPlayerSeqImmediate: (player, seqId) => deps.queuePlayerSeq(player, seqId, 0),
        broadcastPlayerSpot: (player, spotId, height = 0, delay = 0, slot?) => {
            const tick = deps.getCurrentTick();
            deps.enqueueSpotAnimation({
                tick,
                playerId: player.id,
                spotId,
                height,
                delay,
                slot: slot !== undefined && Number.isFinite(slot) ? slot & 0xff : undefined,
            });
        },
        playLocGraphic: deps.playLocGraphic,
        playLocSound: deps.playLocSound,
        playAreaSound: deps.playAreaSound,
        playSong: deps.playSong,
        skipMusicTrack: deps.skipMusicTrack,
        getMusicTrackId: deps.getMusicTrackIdByName,
        getMusicTrackBySlot: deps.getMusicTrackBySlot,
        sendSound: deps.sendSound,
        enqueueSoundBroadcast: deps.enqueueSoundBroadcast,
        stopPlayerAnimation: (player) => { try { player.stopAnimation(); } catch {} },

        // Appearance
        refreshAppearanceKits: deps.refreshAppearanceKits,
        queueAppearanceSnapshot: deps.queueAppearanceSnapshot,
        savePlayerSnapshot: deps.savePlayerSnapshot,
        logoutPlayer: deps.logoutPlayer,

        // Dialog & Interface
        openDialog: deps.openDialog,
        openDialogOptions: deps.openDialogOptions,
        closeDialog: deps.closeDialog,
        closeInterruptibleInterfaces: deps.closeInterruptibleInterfaces,
        openSubInterface: deps.openSubInterface,
        closeSubInterface: deps.closeSubInterface,
        closeModal: deps.closeModal,
        getInterfaceService: deps.getInterfaceService,
        openRemainingTabs: deps.openRemainingTabs,
        queueWidgetEvent: deps.queueWidgetEvent,
        queueClientScript: deps.queueClientScript,

        // Movement
        teleportPlayer: deps.teleportPlayer,
        teleportToInstance: deps.teleportToInstance,
        requestTeleportAction: deps.requestTeleportAction,
        queueForcedMovement: deps.queueForcedMovement,
        getPathService: deps.getPathService,

        // Location
        emitLocChange: deps.emitLocChange,
        sendLocChangeToPlayer: deps.sendLocChangeToPlayer,
        spawnLocForPlayer: deps.spawnLocForPlayer,

        // Combat
        applyPrayers: deps.applyPrayers,
        setCombatSpell: deps.setCombatSpell,
        queueCombatState: deps.queueCombatState,
        requestAction: deps.requestAction,
        getNpc: deps.getNpc,
        isPlayerStunned: deps.isPlayerStunned,
        isPlayerInCombat: deps.isPlayerInCombat,
        applyPlayerHitsplat: deps.applyPlayerHitsplat,
        stunPlayer: deps.stunPlayer,
        scheduleAction: deps.scheduleAction,
        clearPlayerFaceTarget: deps.clearPlayerFaceTarget,

        // NPC
        spawnNpc: deps.spawnNpc,
        removeNpc: deps.removeNpc,
        queueNpcForcedChat: deps.queueNpcForcedChat,
        queueNpcSeq: deps.queueNpcSeq,
        faceNpcToPlayer: deps.faceNpcToPlayer,

        // Collection log
        sendCollectionLogSnapshot: deps.sendCollectionLogSnapshot,
        openCollectionLog: deps.openCollectionLog,
        openCollectionOverview: deps.openCollectionOverview,
        populateCollectionLogCategories: deps.populateCollectionLogCategories,

        // Gathering
        gathering: deps.gathering,
        getWoodcuttingTree: deps.getWoodcuttingTree,
        getMiningRock: deps.getMiningRock,
        getFishingSpot: deps.getFishingSpot,
        isAdjacentToLoc: deps.isAdjacentToLoc,
        isAdjacentToNpc: deps.isAdjacentToNpc,
        faceGatheringTarget: deps.faceGatheringTarget,
        stopGatheringInteraction: (player) => {
            try { player.clearInteraction(); } catch {}
            try { player.stopAnimation(); } catch {}
            try { player.clearPath(); } catch {}
            try { player.clearWalkDestination(); } catch {}
        },
        isFiremakingTileBlocked: deps.isFiremakingTileBlocked,
        lightFire: deps.lightFire,
        playerHasTinderbox: deps.playerHasTinderbox,
        consumeFiremakingLog: deps.consumeFiremakingLog,
        walkPlayerAwayFromFire: deps.walkPlayerAwayFromFire,
        getCookingRecipeByRawItemId: deps.getCookingRecipeByRawItemId,

        // Production
        production: deps.production,

        // Followers
        followers: deps.followers,

        // Sailing
        sailing: deps.sailing,
    };
}
