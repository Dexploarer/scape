import { describe, expect, test } from "bun:test";

import type { ControlPlaneClient } from "../server/src/controlplane/ControlPlaneClient";
import { HostedSessionIssuerService } from "../server/src/auth/HostedSessionIssuerService";
import { HostedSessionService } from "../server/src/auth/HostedSessionService";

function createFakeControlPlane(): ControlPlaneClient & {
    upsertedWorlds: any[];
    upsertedPrincipals: any[];
    upsertedWorldCharacters: any[];
} {
    return {
        upsertedWorlds: [],
        upsertedPrincipals: [],
        upsertedWorldCharacters: [],
        async initialize() {},
        async disconnect() {},
        async listLoginAccounts() {
            return [];
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
        async upsertWorld(payload) {
            this.upsertedWorlds.push(payload);
        },
        async upsertPrincipal(payload) {
            this.upsertedPrincipals.push(payload);
        },
        async upsertLoginAccount() {},
        async touchLoginAccount() {},
        async upsertWorldCharacter(payload) {
            this.upsertedWorldCharacters.push(payload);
        },
        async touchWorldCharacter() {},
        async putPlayerSnapshot() {},
        async upsertTrajectoryEpisode() {},
        async putTrajectoryStep() {},
        async putLiveEvent() {},
    };
}

describe("HostedSessionIssuerService", () => {
    test("issues hosted human sessions for the configured world", async () => {
        const now = 1_700_000_000_000;
        const hostedSessionService = new HostedSessionService({
            secret: "session-secret",
            now: () => now,
        });
        const issuer = new HostedSessionIssuerService({
            hostedSessionService,
            issuerSecret: "issuer-secret",
            worldId: "Toonscape",
            now: () => now,
        });

        const result = await issuer.issue("Bearer issuer-secret", {
            kind: "human",
            principalId: "principal:alice",
            displayName: "Alice",
            worldCharacterId: "char-1",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.payload.claims).toMatchObject({
            kind: "human",
            principalId: "principal:alice",
            worldId: "toonscape",
            worldCharacterId: "char-1",
            displayName: "Alice",
            issuedAt: now,
            expiresAt: now + 5 * 60 * 1000,
        });

        expect(
            hostedSessionService.verify(result.payload.sessionToken, {
                kind: "human",
                worldId: "toonscape",
                worldCharacterId: "char-1",
            }),
        ).toMatchObject({ ok: true });
    });

    test("issues hosted agent sessions with explicit ttl and agent id", async () => {
        const now = 1_700_000_000_000;
        const hostedSessionService = new HostedSessionService({
            secret: "session-secret",
            now: () => now,
        });
        const issuer = new HostedSessionIssuerService({
            hostedSessionService,
            issuerSecret: "issuer-secret",
            worldId: "scape",
            now: () => now,
            maxTtlMs: 60_000,
        });

        const result = await issuer.issue("Bearer issuer-secret", {
            kind: "agent",
            principalId: "principal:agent-1",
            displayName: "Agent One",
            worldCharacterId: "agent-char",
            agentId: "agent-1",
            ttlMs: 30_000,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.payload.claims).toMatchObject({
            kind: "agent",
            agentId: "agent-1",
            expiresAt: now + 30_000,
        });
    });

    test("provisions principal and world character rows when control plane is configured", async () => {
        const now = 1_700_000_000_000;
        const hostedSessionService = new HostedSessionService({
            secret: "session-secret",
            now: () => now,
        });
        const controlPlane = createFakeControlPlane();
        const issuer = new HostedSessionIssuerService({
            hostedSessionService,
            issuerSecret: "issuer-secret",
            worldId: "toonscape",
            worldName: "Toonscape",
            gamemodeId: "vanilla",
            controlPlane,
            now: () => now,
        });

        const result = await issuer.issue("Bearer issuer-secret", {
            kind: "agent",
            principalId: "principal:agent-77",
            displayName: "Toon Agent",
            worldCharacterId: "toon-77",
            agentId: "agent-77",
        });

        expect(result.ok).toBe(true);
        expect(controlPlane.upsertedWorlds).toHaveLength(1);
        expect(controlPlane.upsertedPrincipals[0]).toMatchObject({
            principal_id: "principal:agent-77",
            principal_kind: "agent",
            canonical_name: "toon agent",
        });
        expect(controlPlane.upsertedWorldCharacters[0]).toMatchObject({
            world_character_id: "toon-77",
            principal_id: "principal:agent-77",
            save_key: "world:toonscape:character:toon-77",
            branch_kind: "hosted",
        });
    });

    test("rejects bad bearer tokens, mismatched worlds, and invalid ttl values", async () => {
        const now = 1_700_000_000_000;
        const hostedSessionService = new HostedSessionService({
            secret: "session-secret",
            now: () => now,
        });
        const issuer = new HostedSessionIssuerService({
            hostedSessionService,
            issuerSecret: "issuer-secret",
            worldId: "scape",
            now: () => now,
            maxTtlMs: 60_000,
        });

        expect(
            await issuer.issue("Bearer wrong-secret", {
                kind: "human",
                principalId: "principal:alice",
                displayName: "Alice",
                worldCharacterId: "char-1",
            }),
        ).toMatchObject({
            ok: false,
            status: 401,
            payload: { code: "bad_issuer_token" },
        });

        expect(
            await issuer.issue("Bearer issuer-secret", {
                kind: "human",
                principalId: "principal:alice",
                displayName: "Alice",
                worldCharacterId: "char-1",
                worldId: "toonscape",
            }),
        ).toMatchObject({
            ok: false,
            status: 400,
            payload: { code: "bad_world" },
        });

        expect(
            await issuer.issue("Bearer issuer-secret", {
                kind: "agent",
                principalId: "principal:agent-1",
                displayName: "Agent One",
                worldCharacterId: "agent-char",
                ttlMs: 120_000,
            }),
        ).toMatchObject({
            ok: false,
            status: 400,
            payload: { code: "missing_agent_id" },
        });

        expect(
            await issuer.issue("Bearer issuer-secret", {
                kind: "human",
                principalId: "principal:alice",
                displayName: "Alice",
                worldCharacterId: "char-1",
                ttlMs: 120_000,
            }),
        ).toMatchObject({
            ok: false,
            status: 400,
            payload: { code: "ttl_too_large" },
        });
    });
});
