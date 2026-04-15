import { describe, expect, test } from "bun:test";

import type {
    ControlPlaneClient,
    TouchLoginAccountPayload,
    UpsertLoginAccountPayload,
    UpsertPrincipalPayload,
} from "../server/src/controlplane/ControlPlaneClient";
import {
    createPasswordAccountRecord,
    type AccountRecord,
} from "../server/src/game/state/AccountStore";
import { SpacetimeAccountStore } from "../server/src/game/state/SpacetimeAccountStore";

function toLoginAccountRow(record: AccountRecord) {
    return {
        username: record.username,
        principal_id: `principal:login:${record.username}`,
        auth_mode: "password",
        password_hash: record.passwordHash,
        password_salt: record.passwordSalt,
        password_algorithm: record.algorithm,
        banned: !!record.banned,
        ban_reason: record.banReason,
        created_at: BigInt(record.createdAt) * 1000n,
        last_login_at:
            record.lastLoginAt === undefined ? undefined : BigInt(record.lastLoginAt) * 1000n,
    };
}

function createFakeControlPlane(accounts: AccountRecord[] = []): ControlPlaneClient & {
    touchedLogins: TouchLoginAccountPayload[];
    upsertedLogins: UpsertLoginAccountPayload[];
    upsertedPrincipals: UpsertPrincipalPayload[];
} {
    const rows = accounts.map(toLoginAccountRow);
    return {
        touchedLogins: [],
        upsertedLogins: [],
        upsertedPrincipals: [],
        async initialize() {},
        async disconnect() {},
        async listLoginAccounts() {
            return rows;
        },
        async getLoginAccount() {
            return undefined;
        },
        async listWorldCharactersForWorld() {
            return [];
        },
        async getWorldCharacter() {
            return undefined;
        },
        async getWorldCharacterBySaveKey() {
            return undefined;
        },
        async listPlayerSnapshotsForWorld() {
            return [];
        },
        async getPlayerSnapshot() {
            return undefined;
        },
        async getPlayerSnapshotBySaveKey() {
            return undefined;
        },
        async upsertWorld() {},
        async upsertPrincipal(payload) {
            this.upsertedPrincipals.push(payload);
        },
        async upsertLoginAccount(payload) {
            this.upsertedLogins.push(payload);
        },
        async touchLoginAccount(payload) {
            this.touchedLogins.push(payload);
        },
        async upsertWorldCharacter() {},
        async touchWorldCharacter() {},
        async putPlayerSnapshot() {},
        async upsertTrajectoryEpisode() {},
        async putTrajectoryStep() {},
        async putLiveEvent() {},
    };
}

describe("SpacetimeAccountStore", () => {
    test("loads existing password accounts and touches last login on success", async () => {
        const existing = createPasswordAccountRecord("alice", "hunter2-password");
        const controlPlane = createFakeControlPlane([existing]);
        const store = new SpacetimeAccountStore({
            controlPlane,
            minPasswordLength: 8,
        });

        await store.initialize();
        const result = store.verifyOrRegister("alice", "hunter2-password");
        await store.dispose();

        expect(result.kind).toBe("ok");
        expect(result.kind === "ok" ? result.created : false).toBe(false);
        expect(controlPlane.touchedLogins).toHaveLength(1);
        expect(controlPlane.touchedLogins[0]?.username).toBe("alice");
    });

    test("registers new accounts through principal + login upserts", async () => {
        const controlPlane = createFakeControlPlane();
        const store = new SpacetimeAccountStore({
            controlPlane,
            minPasswordLength: 8,
        });

        await store.initialize();
        const result = store.verifyOrRegister("new-user", "supersecure");
        await store.dispose();

        expect(result.kind).toBe("ok");
        expect(result.kind === "ok" ? result.created : false).toBe(true);
        expect(controlPlane.upsertedPrincipals).toHaveLength(1);
        expect(controlPlane.upsertedPrincipals[0]?.principal_id).toBe(
            "principal:login:new-user",
        );
        expect(controlPlane.upsertedLogins).toHaveLength(1);
        expect(controlPlane.upsertedLogins[0]?.username).toBe("new-user");
        expect(controlPlane.upsertedLogins[0]?.password_hash).toBeTruthy();
        expect(controlPlane.upsertedLogins[0]?.password_salt).toBeTruthy();
    });
});
