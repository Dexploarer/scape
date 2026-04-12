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

export interface ControlPlaneClient {
    listLoginAccounts(): Promise<ControlPlaneLoginAccountRecord[]>;
    upsertPrincipal(record: ControlPlanePrincipalRecord): Promise<void>;
    upsertLoginAccount(record: ControlPlaneLoginAccountRecord): Promise<void>;
    touchLoginAccount(username: string, lastLoginAt?: number): Promise<void>;
    dispose?(): Promise<void> | void;
}

