import { describe, expect, test } from "bun:test";

import { HostedSessionIssuerService } from "../server/src/auth/HostedSessionIssuerService";
import { HostedSessionService } from "../server/src/auth/HostedSessionService";

describe("HostedSessionIssuerService", () => {
    test("issues hosted human sessions for the configured world", () => {
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

        const result = issuer.issue("Bearer issuer-secret", {
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

    test("issues hosted agent sessions with explicit ttl and agent id", () => {
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

        const result = issuer.issue("Bearer issuer-secret", {
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

    test("rejects bad bearer tokens, mismatched worlds, and invalid ttl values", () => {
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
            issuer.issue("Bearer wrong-secret", {
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
            issuer.issue("Bearer issuer-secret", {
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
            issuer.issue("Bearer issuer-secret", {
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
            issuer.issue("Bearer issuer-secret", {
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
