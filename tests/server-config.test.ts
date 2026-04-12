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

    test("ALLOW_JSON_ACCOUNT_FALLBACK opts into JSON fallback for hosted database errors", () => {
        const config = createServerConfig({
            env: {
                ALLOW_JSON_ACCOUNT_FALLBACK: "true",
            },
        });

        expect(config.allowJsonAccountFallback).toBe(true);
    });

    test("ALLOW_JSON_ACCOUNT_FALLBACK defaults off", () => {
        const config = createServerConfig({
            env: {},
        });

        expect(config.allowJsonAccountFallback).toBe(false);
    });

    test("NODE_ENV=production sets production runtime mode", () => {
        const config = createServerConfig({
            env: {
                NODE_ENV: "production",
            },
        });

        expect(config.runtimeMode).toBe("production");
    });

    test("runtime mode defaults to development when NODE_ENV is unset", () => {
        const config = createServerConfig({
            env: {},
        });

        expect(config.runtimeMode).toBe("development");
    });
});
