/**
 * Network managers module.
 *
 * Contains specialized managers for network-related functionality,
 * extracted from wsServer for better organization and testability.
 */

export {
    NpcSyncManager,
    type NpcSyncManagerServices,
    type NpcManagerRef,
    type HealthBarDefLoaderRef,
    type HealthBarUpdatePayload,
    type NpcViewSnapshot,
    type NpcUpdatePayload,
    type NpcPacketBuffer,
    type NpcTickFrame,
} from "./NpcSyncManager";

export {
    PlayerAppearanceManager,
    type PlayerAppearanceServices,
    type PlayerAnimSet,
    type AppearanceSnapshotEntry,
    type ObjTypeLoaderRef,
    type BasTypeLoaderRef,
    type IdkTypeLoaderRef,
} from "./PlayerAppearanceManager";

export {
    SoundManager,
    type SoundManagerServices,
    type SoundBroadcastRequest,
    type LocSoundRequest,
    type AreaSoundRequest,
    type TickFrameRef,
    type NpcSoundLookupRef,
    type MusicRegionServiceRef,
    type MusicUnlockServiceRef,
    type NpcTypeLoaderRef,
    type DbRepositoryRef,
    type PlayerCollectionRef as SoundPlayerCollectionRef,
    type WebSocketRef as SoundWebSocketRef,
} from "./SoundManager";

export {
    GroundItemHandler,
    type GroundItemHandlerServices,
    type GroundItemActionPayload,
    type GroundItemsServerPayload,
    type WebSocketRef as GroundItemWebSocketRef,
    type PlayerCollectionRef as GroundItemPlayerCollectionRef,
    type ItemDefinition,
} from "./GroundItemHandler";

export { Cs2ModalManager, type Cs2ModalManagerServices } from "./Cs2ModalManager";
