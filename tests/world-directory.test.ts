import { afterEach, describe, expect, test } from "bun:test";

import {
    findConfiguredWorldById,
    getConfiguredWorldServers,
    getConfiguredWorlds,
    getNextConfiguredWorld,
    getWorldSwitcherButtonText,
    setConfiguredWorldServers,
} from "../src/client/login/worldDirectory";

const originalServers = [...getConfiguredWorldServers()];
const defaultServer = originalServers[0];

afterEach(() => {
    setConfiguredWorldServers(originalServers);
});

describe("worldDirectory", () => {
    test("maps configured servers to stable world ids", () => {
        setConfiguredWorldServers([
            {
                name: defaultServer.name,
                address: defaultServer.address,
                secure: defaultServer.secure,
                playerCount: 41,
                maxPlayers: 2047,
            },
            {
                name: "Toonscape",
                address: "toon.example.com",
                secure: true,
                playerCount: 12,
                maxPlayers: 2047,
            },
        ]);

        const worlds = getConfiguredWorlds();
        expect(worlds.slice(0, 2)).toEqual([
            {
                id: 301,
                name: defaultServer.name,
                address: defaultServer.address,
                secure: defaultServer.secure,
                playerCount: 41,
                maxPlayers: 2047,
                activity: defaultServer.name,
                location: 0,
                properties: 0,
            },
            {
                id: 302,
                name: "Toonscape",
                address: "toon.example.com",
                secure: true,
                playerCount: 12,
                maxPlayers: 2047,
                activity: "Toonscape",
                location: 0,
                properties: 0,
            },
        ]);
        expect(findConfiguredWorldById(302)?.name).toBe("Toonscape");
    });

    test("returns the other configured world for the logout tab switcher", () => {
        setConfiguredWorldServers([
            {
                name: defaultServer.name,
                address: defaultServer.address,
                secure: defaultServer.secure,
                playerCount: 41,
                maxPlayers: 2047,
            },
            {
                name: "Toonscape",
                address: "toon.example.com",
                secure: true,
                playerCount: 12,
                maxPlayers: 2047,
            },
        ]);

        expect(
            getNextConfiguredWorld(defaultServer.address, defaultServer.secure)?.name,
        ).toBe("Toonscape");
        expect(getNextConfiguredWorld("toon.example.com", true)?.name).toBe(defaultServer.name);
        expect(getWorldSwitcherButtonText(defaultServer.address, defaultServer.secure)).toBe(
            "Switch to Toonscape",
        );
        expect(getWorldSwitcherButtonText("toon.example.com", true)).toBe(
            `Switch to ${defaultServer.name}`,
        );
    });
});
