import { describe, expect, test } from "bun:test";

import {
    buildHostedWebLaunchUrl,
    parseIssueHostedSessionArgs,
} from "../scripts/issue-hosted-session";

describe("issue-hosted-session script helpers", () => {
    test("parses agent args with env fallbacks", () => {
        const options = parseIssueHostedSessionArgs(
            [
                "--kind",
                "agent",
                "--principal-id",
                "principal:agent-77",
                "--display-name",
                "Toon Agent",
                "--world-character-id",
                "toon-77",
                "--agent-id",
                "agent-77",
                "--ttl-ms",
                "300000",
                "--json",
            ],
            {
                HOSTED_SESSION_ISSUER_SECRET: "issuer-secret",
                HOSTED_SESSION_ISSUER_URL: "https://world.example/hosted-session/issue",
                WEB_CLIENT_BASE_URL: "https://play.example/game",
            },
        );

        expect(options).toMatchObject({
            kind: "agent",
            principalId: "principal:agent-77",
            displayName: "Toon Agent",
            worldCharacterId: "toon-77",
            agentId: "agent-77",
            ttlMs: 300000,
            issuerSecret: "issuer-secret",
            issuerUrl: "https://world.example/hosted-session/issue",
            webBaseUrl: "https://play.example/game",
            json: true,
        });
    });

    test("requires agent id for agent sessions", () => {
        expect(() =>
            parseIssueHostedSessionArgs(
                [
                    "--kind",
                    "agent",
                    "--principal-id",
                    "principal:agent-77",
                    "--display-name",
                    "Toon Agent",
                    "--world-character-id",
                    "toon-77",
                ],
                {
                    HOSTED_SESSION_ISSUER_SECRET: "issuer-secret",
                },
            ),
        ).toThrow("--agent-id is required");
    });

    test("builds launch urls by appending hosted query params", () => {
        expect(
            buildHostedWebLaunchUrl(
                "https://play.example/game?foo=bar",
                "hs1.payload.signature",
                "toon-77",
            ),
        ).toBe(
            "https://play.example/game?foo=bar&sessionToken=hs1.payload.signature&worldCharacterId=toon-77",
        );
    });
});
