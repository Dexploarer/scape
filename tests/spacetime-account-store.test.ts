import { describe, expect, test } from "bun:test";

import type {
    ControlPlaneClient,
    ControlPlaneLoginAccountRecord,
    ControlPlanePrincipalRecord,
} from "../server/src/controlplane/ControlPlaneClient";
import { SpacetimeAccountStore } from "../server/src/game/state/SpacetimeAccountStore";

class FakeControlPlaneClient implements ControlPlaneClient {
    constructor(private readonly seedAccounts: ControlPlaneLoginAccountRecord[] = []) {}

    readonly principals: ControlPlanePrincipalRecord[] = [];
    readonly loginAccounts: ControlPlaneLoginAccountRecord[] = [];
    readonly touches: Array<{ username: string; lastLoginAt?: number }> = [];

    async listLoginAccounts(): Promise<ControlPlaneLoginAccountRecord[]> {
        return this.seedAccounts;
    }

    async upsertPrincipal(record: ControlPlanePrincipalRecord): Promise<void> {
        this.principals.push(record);
    }

    async upsertLoginAccount(record: ControlPlaneLoginAccountRecord): Promise<void> {
        this.loginAccounts.push(record);
    }

    async touchLoginAccount(username: string, lastLoginAt?: number): Promise<void> {
        this.touches.push({ username, lastLoginAt });
    }
}

describe("SpacetimeAccountStore", () => {
    test("loads existing accounts and validates reused credentials", async () => {
        const bootstrap = await SpacetimeAccountStore.create({
            client: new FakeControlPlaneClient(),
            minPasswordLength: 8,
        });
        const created = bootstrap.verifyOrRegister("Alice", "hunter22");
        expect(created.kind).toBe("ok");
        expect(created.kind === "ok" ? created.created : false).toBe(true);

        const seedClient = new FakeControlPlaneClient([
            {
                username: "alice",
                principalId: "account:alice",
                authMode: "password",
                passwordHash: created.kind === "ok" ? created.account.passwordHash : undefined,
                passwordSalt: created.kind === "ok" ? created.account.passwordSalt : undefined,
                passwordAlgorithm: created.kind === "ok" ? created.account.algorithm : undefined,
                banned: false,
                createdAt: created.kind === "ok" ? created.account.createdAt : 0,
                lastLoginAt: created.kind === "ok" ? created.account.lastLoginAt : undefined,
            },
        ]);
        const store = await SpacetimeAccountStore.create({
            client: seedClient,
            minPasswordLength: 8,
        });

        const reused = store.verifyOrRegister("Alice", "hunter22");
        const wrongPassword = store.verifyOrRegister("Alice", "wrongpass");

        expect(reused.kind).toBe("ok");
        expect(reused.kind === "ok" ? reused.created : true).toBe(false);
        expect(wrongPassword).toEqual({ kind: "wrong_password" });
        expect(seedClient.touches).toHaveLength(1);
        expect(seedClient.touches[0]?.username).toBe("alice");
    });

    test("auto-registers new accounts and mirrors principal plus login account writes", async () => {
        const client = new FakeControlPlaneClient();
        const store = await SpacetimeAccountStore.create({
            client,
            minPasswordLength: 8,
        });

        const created = store.verifyOrRegister("Toon", "hunter22");
        await Promise.resolve();
        await Promise.resolve();

        expect(created.kind).toBe("ok");
        expect(created.kind === "ok" ? created.created : false).toBe(true);
        expect(store.exists("toon")).toBe(true);
        expect(client.principals).toHaveLength(1);
        expect(client.principals[0]).toMatchObject({
            principalId: "account:toon",
            principalKind: "human",
            canonicalName: "toon",
        });
        expect(client.loginAccounts).toHaveLength(1);
        expect(client.loginAccounts[0]).toMatchObject({
            username: "toon",
            principalId: "account:toon",
            authMode: "password",
            banned: false,
        });
    });
});
