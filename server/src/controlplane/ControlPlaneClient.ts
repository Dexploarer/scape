export interface ControlPlanePrincipalRecord {
    principalId: string;
    principalKind: string;
    canonicalName: string;
    createdAt: number;
    updatedAt: number;
}

export interface ControlPlaneLoginAccountRecord {
    username: string;
    principalId: string;
    authMode: string;
    passwordHash?: string;
    passwordSalt?: string;
    passwordAlgorithm?: string;
    externalSubject?: string;
    banned: boolean;
    banReason?: string;
    createdAt: number;
    lastLoginAt?: number;
}

export interface ControlPlaneWorldCharacterRecord {
    worldCharacterId: string;
    worldId: string;
    principalId: string;
    displayName: string;
    saveKey?: string;
    branchKind?: string;
    createdAt: number;
    lastSeenAt?: number;
}

export interface ControlPlanePlayerSnapshotRecord {
    worldCharacterId: string;
    worldId: string;
    principalId: string;
    snapshotVersion: number;
    persistentVarsJson: string;
    updatedAt: number;
}

export interface UpsertWorldPayload {
    world_id: string;
    name: string;
    gamemode_id: string;
    status: string;
    release_id?: string;
    owner_principal_id?: string;
    metadata_json?: string;
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
    password_hash?: string;
    password_salt?: string;
    password_algorithm?: string;
    external_subject?: string;
    banned: boolean;
    ban_reason?: string;
    created_at: bigint;
    last_login_at?: bigint;
}

export interface TouchLoginAccountPayload {
    username: string;
    last_login_at?: bigint;
}

export interface UpsertWorldCharacterPayload {
    world_character_id: string;
    world_id: string;
    principal_id: string;
    display_name: string;
    save_key?: string;
    branch_kind?: string;
    created_at: bigint;
    last_seen_at?: bigint;
}

export interface TouchWorldCharacterPayload {
    world_character_id: string;
    last_seen_at?: bigint;
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
    metadata_json?: string;
    started_at: bigint;
    ended_at?: bigint;
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
    action_name?: string;
    correlation_id?: string;
    observation_json?: string;
    payload_json?: string;
    outcome_json?: string;
    recorded_at: bigint;
}

export interface PutLiveEventPayload {
    event_id: string;
    world_id: string;
    principal_id?: string;
    world_character_id?: string;
    player_id?: number;
    source: string;
    event_name: string;
    payload_json: string;
    recorded_at: bigint;
}

export interface ControlPlaneClient {
    listLoginAccounts(): Promise<ControlPlaneLoginAccountRecord[]>;
    getLoginAccount?(username: string): Promise<ControlPlaneLoginAccountRecord | undefined>;
    listWorldCharactersForWorld(worldId: string): Promise<ControlPlaneWorldCharacterRecord[]>;
    getWorldCharacter?(worldCharacterId: string): Promise<ControlPlaneWorldCharacterRecord | undefined>;
    getWorldCharacterBySaveKey?(
        worldId: string,
        saveKey: string,
    ): Promise<ControlPlaneWorldCharacterRecord | undefined>;
    listPlayerSnapshotsForWorld(worldId: string): Promise<ControlPlanePlayerSnapshotRecord[]>;
    getPlayerSnapshot?(worldCharacterId: string): Promise<ControlPlanePlayerSnapshotRecord | undefined>;
    getPlayerSnapshotBySaveKey?(
        worldId: string,
        saveKey: string,
    ): Promise<ControlPlanePlayerSnapshotRecord | undefined>;
    upsertWorld?(payload: UpsertWorldPayload): Promise<void>;
    upsertPrincipal(
        record: ControlPlanePrincipalRecord | UpsertPrincipalPayload,
    ): Promise<void>;
    upsertLoginAccount(
        record: ControlPlaneLoginAccountRecord | UpsertLoginAccountPayload,
    ): Promise<void>;
    upsertWorldCharacter(
        record: ControlPlaneWorldCharacterRecord | UpsertWorldCharacterPayload,
    ): Promise<void>;
    putPlayerSnapshot(
        record: ControlPlanePlayerSnapshotRecord | PutPlayerSnapshotPayload,
    ): Promise<void>;
    upsertTrajectoryEpisode?(payload: UpsertTrajectoryEpisodePayload): Promise<void>;
    putTrajectoryStep?(payload: PutTrajectoryStepPayload): Promise<void>;
    putLiveEvent?(payload: PutLiveEventPayload): Promise<void>;
    touchLoginAccount(
        username: string | TouchLoginAccountPayload,
        lastLoginAt?: number,
    ): Promise<void>;
    touchWorldCharacter(
        worldCharacterId: string | TouchWorldCharacterPayload,
        lastSeenAt?: number,
    ): Promise<void>;
    dispose?(): Promise<void> | void;
}
