import { describe, expect, test } from "bun:test";

import { createServerConfig } from "../server/src/config";

describe("createServerConfig", () => {
    test("defaults WORLD_ID to the gamemode", () => {
        const config = createServerConfig({}, { gamemode: "vanilla" });
        expect(config.worldId).toBe("vanilla");
    });

    test("normalizes explicit WORLD_ID overrides", () => {
        const config = createServerConfig(
            {
                WORLD_ID: " Toon World!! ",
                HOSTED_SESSION_SECRET: " hosted-secret ",
                HOSTED_SESSION_ISSUER_SECRET: " issuer-secret ",
            },
            { gamemode: "vanilla" },
        );

        expect(config.worldId).toBe("toon-world");
        expect(config.hostedSessionSecret).toBe("hosted-secret");
        expect(config.hostedSessionIssuerSecret).toBe("issuer-secret");
    });

    test("enables spacetime config when uri and database are set", () => {
        const config = createServerConfig(
            {
                SPACETIMEDB_URI: " wss://spacetime.example/ws ",
                SPACETIMEDB_DATABASE: " scape-control ",
                SPACETIMEDB_TOKEN: " token-123 ",
                SPACETIMEDB_CONNECT_TIMEOUT_MS: "2500",
            },
            { gamemode: "vanilla" },
        );

        expect(config.spacetimeEnabled).toBe(true);
        expect(config.spacetimeUri).toBe("wss://spacetime.example/ws");
        expect(config.spacetimeDatabase).toBe("scape-control");
        expect(config.spacetimeToken).toBe("token-123");
        expect(config.spacetimeConnectTimeoutMs).toBe(2500);
    });
});
