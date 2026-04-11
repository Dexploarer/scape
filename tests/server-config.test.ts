import { describe, expect, test } from "bun:test";

import { createServerConfig } from "../server/src/config";

describe("createServerConfig", () => {
    test("SERVER_NAME overrides the file-based server name", () => {
        const config = createServerConfig({
            env: {
                SERVER_NAME: "Toonscape",
                HOST: "0.0.0.0",
                PORT: "43594",
            },
            fileConfig: {
                serverName: "Your Server Name",
                maxPlayers: 2047,
            },
        });

        expect(config.serverName).toBe("Toonscape");
        expect(config.maxPlayers).toBe(2047);
        expect(config.host).toBe("0.0.0.0");
        expect(config.port).toBe(43594);
    });

    test("blank SERVER_NAME does not clobber the file-based name", () => {
        const config = createServerConfig({
            env: {
                SERVER_NAME: "   ",
            },
            fileConfig: {
                serverName: "Production",
            },
        });

        expect(config.serverName).toBe("Production");
    });
});
