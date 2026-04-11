import { describe, expect, test } from "bun:test";

import {
    appendCacheBustParam,
    createDefaultServerDirectoryUrl,
    createDefaultServerDirectoryEntry,
    normalizeServerDirectoryEntries,
} from "../src/client/login/serverDirectory";
import { shouldBypassWorldSelection } from "../src/client/worldSelectionGate";

describe("normalizeServerDirectoryEntries", () => {
    test("appends a cache-busting query param to bare URLs", () => {
        expect(appendCacheBustParam("https://scape-96cxt.sevalla.app/status", "abc123")).toBe(
            "https://scape-96cxt.sevalla.app/status?cb=abc123",
        );
    });

    test("appends a cache-busting query param to URLs with existing query params", () => {
        expect(appendCacheBustParam("https://scape-96cxt.sevalla.app/status?foo=1", "abc123")).toBe(
            "https://scape-96cxt.sevalla.app/status?foo=1&cb=abc123",
        );
    });

    test("derives the default directory URL from the websocket host when no override is set", () => {
        expect(createDefaultServerDirectoryUrl({
            address: "scape-96cxt.sevalla.app",
            secure: true,
        }, undefined)).toBe("https://scape-96cxt.sevalla.app/servers.json");
    });

    test("prefers an explicit directory URL override when provided", () => {
        expect(createDefaultServerDirectoryUrl({
            address: "scape-96cxt.sevalla.app",
            secure: true,
        }, "https://directory.example.com/worlds.json")).toBe("https://directory.example.com/worlds.json");
    });

    test("prepends the build default when the feed is empty", () => {
        const defaultEntry = {
            ...createDefaultServerDirectoryEntry(),
            id: 77,
            name: "Hosted Default",
            address: "game.example.com",
            secure: true,
            activity: "Hosted Default",
        };

        expect(normalizeServerDirectoryEntries([], defaultEntry)).toEqual([defaultEntry]);
    });

    test("normalizes directory entries and strips invalid rows", () => {
        const entries = normalizeServerDirectoryEntries([
            {
                id: 12,
                name: "Alpha",
                address: "wss://alpha.example.com/socket",
                maxPlayers: 300,
                location: 1,
                activity: "Trade",
                properties: 1,
                description: "Primary world",
            },
            {
                name: "Broken",
                address: "",
            },
            {
                id: 12,
                name: "Beta",
                address: "beta.example.com/play",
                secure: true,
                maxPlayers: 150,
            },
        ], {
            ...createDefaultServerDirectoryEntry(),
            id: 1,
            name: "Hosted Default",
            address: "game.example.com",
            secure: true,
            activity: "Hosted Default",
        });

        expect(entries).toEqual([
            {
                id: 2,
                activity: "Hosted Default",
                name: "Hosted Default",
                address: "game.example.com",
                secure: true,
                maxPlayers: 2047,
                playerCount: null,
                location: 0,
                properties: 0,
                description: "Default world for this build.",
            },
            {
                id: 12,
                name: "Alpha",
                address: "alpha.example.com",
                secure: true,
                maxPlayers: 300,
                playerCount: null,
                location: 1,
                activity: "Trade",
                properties: 1,
                description: "Primary world",
            },
            {
                id: 1,
                name: "Beta",
                address: "beta.example.com",
                secure: true,
                maxPlayers: 150,
                playerCount: null,
                location: 0,
                activity: "-",
                properties: 0,
                description: undefined,
            },
        ]);
    });

    test("does not duplicate the build default when it already exists", () => {
        const defaultEntry = {
            ...createDefaultServerDirectoryEntry(),
            id: 5,
            name: "Hosted Default",
            address: "game.example.com",
            secure: true,
            activity: "Hosted Default",
        };

        const entries = normalizeServerDirectoryEntries([
            {
                id: 5,
                name: "Hosted Default",
                address: "wss://game.example.com",
                secure: true,
            },
        ], defaultEntry);

        expect(entries).toHaveLength(1);
        expect(entries[0]?.address).toBe("game.example.com");
    });
});

describe("shouldBypassWorldSelection", () => {
    test("bypasses for auto-login query params", () => {
        expect(shouldBypassWorldSelection("?username=tester")).toBe(true);
        expect(shouldBypassWorldSelection("?password=secret")).toBe(true);
        expect(shouldBypassWorldSelection("?autoplay=1")).toBe(true);
    });

    test("does not bypass for normal entry URLs", () => {
        expect(shouldBypassWorldSelection("")).toBe(false);
        expect(shouldBypassWorldSelection("?foo=bar")).toBe(false);
    });
});
