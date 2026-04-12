import { describe, expect, test } from "bun:test";

import { buildServerStatus } from "../server/src/network/ServerStatus";

describe("buildServerStatus", () => {
    test("returns a normalized payload including runtime mode", () => {
        expect(
            buildServerStatus({
                serverName: "-scape",
                playerCount: 12,
                maxPlayers: 2047,
                runtimeMode: "production",
            }),
        ).toEqual({
            serverName: "-scape",
            playerCount: 12,
            maxPlayers: 2047,
            runtimeMode: "production",
        });
    });
});
