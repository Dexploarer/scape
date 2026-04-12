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
});
