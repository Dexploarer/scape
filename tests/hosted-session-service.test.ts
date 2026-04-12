import { describe, expect, test } from "bun:test";

import { HostedSessionService } from "../server/src/auth/HostedSessionService";

describe("HostedSessionService", () => {
    test("issues and verifies hosted human sessions for the configured world", () => {
        let now = 1_000_000;
        const service = new HostedSessionService({
            secret: "super-secret",
            now: () => now,
        });

        const token = service.issue({
            kind: "human",
            principalId: "principal-1",
            worldId: "scape",
            worldCharacterId: "char-1",
            displayName: "Dexplorer",
            issuedAt: now,
            expiresAt: now + 60_000,
        });

        const verified = service.verify(token, {
            kind: "human",
            worldId: "scape",
            worldCharacterId: "char-1",
        });

        expect(verified).toMatchObject({
            ok: true,
            claims: {
                kind: "human",
                principalId: "principal-1",
                worldId: "scape",
                worldCharacterId: "char-1",
                displayName: "Dexplorer",
            },
        });
    });

    test("rejects tampered, expired, and mismatched agent tokens", () => {
        let now = 5_000;
        const service = new HostedSessionService({
            secret: "agent-secret",
            now: () => now,
        });

        const token = service.issue({
            kind: "agent",
            principalId: "agent-principal",
            worldId: "toonscape",
            worldCharacterId: "toon-77",
            displayName: "Toon Agent",
            agentId: "agent-77",
            issuedAt: now,
            expiresAt: now + 2_000,
        });

        const tampered = `${token.slice(0, -1)}x`;
        expect(
            service.verify(tampered, {
                kind: "agent",
                worldId: "toonscape",
                worldCharacterId: "toon-77",
                agentId: "agent-77",
            }),
        ).toMatchObject({ ok: false, code: "bad_session_signature" });

        expect(
            service.verify(token, {
                kind: "agent",
                worldId: "scape",
                worldCharacterId: "toon-77",
                agentId: "agent-77",
            }),
        ).toMatchObject({ ok: false, code: "bad_session_world" });

        expect(
            service.verify(token, {
                kind: "agent",
                worldId: "toonscape",
                worldCharacterId: "toon-77",
                agentId: "different-agent",
            }),
        ).toMatchObject({ ok: false, code: "bad_agent_id" });

        now += 2_001;
        expect(
            service.verify(token, {
                kind: "agent",
                worldId: "toonscape",
                worldCharacterId: "toon-77",
                agentId: "agent-77",
            }),
        ).toMatchObject({ ok: false, code: "session_expired" });
    });
});
