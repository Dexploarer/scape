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

export interface ControlPlaneClient {
    listLoginAccounts(): Promise<ControlPlaneLoginAccountRecord[]>;
    listWorldCharactersForWorld(worldId: string): Promise<ControlPlaneWorldCharacterRecord[]>;
    listPlayerSnapshotsForWorld(worldId: string): Promise<ControlPlanePlayerSnapshotRecord[]>;
    upsertPrincipal(record: ControlPlanePrincipalRecord): Promise<void>;
    upsertLoginAccount(record: ControlPlaneLoginAccountRecord): Promise<void>;
    upsertWorldCharacter(record: ControlPlaneWorldCharacterRecord): Promise<void>;
    putPlayerSnapshot(record: ControlPlanePlayerSnapshotRecord): Promise<void>;
    touchLoginAccount(username: string, lastLoginAt?: number): Promise<void>;
    touchWorldCharacter(worldCharacterId: string, lastSeenAt?: number): Promise<void>;
    dispose?(): Promise<void> | void;
}
