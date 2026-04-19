import { describe, expect, test } from "bun:test";

import { buildServerDirectoryEntries } from "../server/src/network/ServerDirectory";

describe("ServerDirectory", () => {
    test("prefers forwarded host and https proto for proxied deployments", () => {
        expect(
            buildServerDirectoryEntries({
                serverName: "scape",
                maxPlayers: 2047,
                playerCount: 12,
                worldId: "scape",
                host: "0.0.0.0:43594",
                forwardedHost: "scape-96cxt.sevalla.app",
                forwardedProto: "https",
            }),
        ).toEqual([
            {
                name: "scape",
                address: "scape-96cxt.sevalla.app",
                secure: true,
                maxPlayers: 2047,
                playerCount: 12,
                worldId: "scape",
            },
        ]);
    });

    test("falls back to request host and non-secure transport locally", () => {
        expect(
            buildServerDirectoryEntries({
                serverName: "Local Development",
                maxPlayers: 2047,
                playerCount: 0,
                worldId: "vanilla",
                host: "localhost:43594",
                encrypted: false,
            }),
        ).toEqual([
            {
                name: "Local Development",
                address: "localhost:43594",
                secure: false,
                maxPlayers: 2047,
                playerCount: 0,
                worldId: "vanilla",
            },
        ]);
    });
});
