import { describe, expect, test } from "bun:test";

import { HostedSessionService } from "../server/src/auth/HostedSessionService";

describe("HostedSessionService", () => {
    test("issues and verifies hosted human sessions for the configured world", () => {
        const now = 1_700_000_000_000;
        const service = new HostedSessionService({
            secret: "world-secret",
            now: () => now,
        });

        const token = service.issue({
            kind: "human",
            principalId: "principal:alice",
            worldId: "scape",
            worldCharacterId: "char-1",
            displayName: "Alice",
            issuedAt: now,
            expiresAt: now + 60_000,
        });

        const verified = service.verify(token, {
            kind: "human",
            worldId: "scape",
            worldCharacterId: "char-1",
        });

        expect(verified.ok).toBe(true);
        if (verified.ok) {
            expect(verified.claims).toMatchObject({
                principalId: "principal:alice",
                worldId: "scape",
                worldCharacterId: "char-1",
                displayName: "Alice",
            });
        }
    });

    test("rejects tampered, expired, and mismatched agent sessions", () => {
        const now = 1_700_000_000_000;
        const service = new HostedSessionService({
            secret: "agent-secret",
            now: () => now,
        });

        const token = service.issue({
            kind: "agent",
            principalId: "principal:agent-1",
            worldId: "toonscape",
            worldCharacterId: "toon-77",
            displayName: "Toon Agent",
            agentId: "agent-1",
            issuedAt: now,
            expiresAt: now + 30_000,
        });

        expect(
            service.verify(`${token}x`, {
                kind: "agent",
                worldId: "toonscape",
                worldCharacterId: "toon-77",
                agentId: "agent-1",
            }),
        ).toMatchObject({ ok: false, code: "bad_session_signature" });

        expect(
            service.verify(token, {
                kind: "agent",
                worldId: "scape",
                worldCharacterId: "toon-77",
                agentId: "agent-1",
            }),
        ).toMatchObject({ ok: false, code: "bad_session_world" });

        const expiredService = new HostedSessionService({
            secret: "agent-secret",
            now: () => now + 31_000,
        });
        expect(
            expiredService.verify(token, {
                kind: "agent",
                worldId: "toonscape",
                worldCharacterId: "toon-77",
                agentId: "agent-1",
            }),
        ).toMatchObject({ ok: false, code: "session_expired" });
    });
});
