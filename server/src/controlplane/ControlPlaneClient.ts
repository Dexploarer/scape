import type {
    LoginAccountRow,
    PlayerSnapshotRow,
    WorldCharacterRow,
} from "./moduleBindings";

export interface UpsertWorldPayload {
    world_id: string;
    name: string;
    gamemode_id: string;
    status: string;
    release_id: string | undefined;
    owner_principal_id: string | undefined;
    metadata_json: string | undefined;
    created_at: bigint;
    updated_at: bigint;
}

export interface UpsertPrincipalPayload {
    principal_id: string;
    principal_kind: string;
    canonical_name: string;
    created_at: bigint;
    updated_at: bigint;
}

export interface UpsertLoginAccountPayload {
    username: string;
    principal_id: string;
    auth_mode: string;
    password_hash: string | undefined;
    password_salt: string | undefined;
    password_algorithm: string | undefined;
    external_subject: string | undefined;
    banned: boolean;
    ban_reason: string | undefined;
    created_at: bigint;
    last_login_at: bigint | undefined;
}

export interface TouchLoginAccountPayload {
    username: string;
    last_login_at: bigint | undefined;
}

export interface UpsertWorldCharacterPayload {
    world_character_id: string;
    world_id: string;
    principal_id: string;
    display_name: string;
    save_key: string | undefined;
    branch_kind: string | undefined;
    created_at: bigint;
    last_seen_at: bigint | undefined;
}

export interface TouchWorldCharacterPayload {
    world_character_id: string;
    last_seen_at: bigint | undefined;
}

export interface PutPlayerSnapshotPayload {
    world_character_id: string;
    world_id: string;
    principal_id: string;
    snapshot_version: number;
    persistent_vars_json: string;
    updated_at: bigint;
}

export interface UpsertTrajectoryEpisodePayload {
    episode_id: string;
    world_id: string;
    principal_id: string;
    world_character_id: string;
    agent_id: string;
    player_id: number;
    session_source: string;
    metadata_json: string | undefined;
    started_at: bigint;
    ended_at: bigint | undefined;
}

export interface PutTrajectoryStepPayload {
    step_id: string;
    episode_id: string;
    world_id: string;
    principal_id: string;
    world_character_id: string;
    player_id: number;
    sequence: number;
    event_kind: string;
    action_name: string | undefined;
    correlation_id: string | undefined;
    observation_json: string | undefined;
    payload_json: string | undefined;
    outcome_json: string | undefined;
    recorded_at: bigint;
}

export interface PutLiveEventPayload {
    event_id: string;
    world_id: string;
    principal_id: string | undefined;
    world_character_id: string | undefined;
    player_id: number | undefined;
    source: string;
    event_name: string;
    payload_json: string;
    recorded_at: bigint;
}

export interface ControlPlaneClient {
    initialize(): Promise<void>;
    disconnect(): Promise<void>;
    listLoginAccounts(): Promise<LoginAccountRow[]>;
    getLoginAccount(username: string): Promise<LoginAccountRow | undefined>;
    listWorldCharactersForWorld(worldId: string): Promise<WorldCharacterRow[]>;
    getWorldCharacter(worldCharacterId: string): Promise<WorldCharacterRow | undefined>;
    getWorldCharacterBySaveKey(worldId: string, saveKey: string): Promise<WorldCharacterRow | undefined>;
    listPlayerSnapshotsForWorld(worldId: string): Promise<PlayerSnapshotRow[]>;
    getPlayerSnapshot(worldCharacterId: string): Promise<PlayerSnapshotRow | undefined>;
    getPlayerSnapshotBySaveKey(worldId: string, saveKey: string): Promise<PlayerSnapshotRow | undefined>;
    upsertWorld(payload: UpsertWorldPayload): Promise<void>;
    upsertPrincipal(payload: UpsertPrincipalPayload): Promise<void>;
    upsertLoginAccount(payload: UpsertLoginAccountPayload): Promise<void>;
    touchLoginAccount(payload: TouchLoginAccountPayload): Promise<void>;
    upsertWorldCharacter(payload: UpsertWorldCharacterPayload): Promise<void>;
    touchWorldCharacter(payload: TouchWorldCharacterPayload): Promise<void>;
    putPlayerSnapshot(payload: PutPlayerSnapshotPayload): Promise<void>;
    upsertTrajectoryEpisode(payload: UpsertTrajectoryEpisodePayload): Promise<void>;
    putTrajectoryStep(payload: PutTrajectoryStepPayload): Promise<void>;
    putLiveEvent(payload: PutLiveEventPayload): Promise<void>;
}
