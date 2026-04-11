import { describe, expect, test } from "bun:test";

import { buildWorldDirectory } from "../server/src/network/WorldDirectory";

describe("buildWorldDirectory", () => {
    test("falls back to the public websocket URL when no explicit directory is set", () => {
        expect(buildWorldDirectory({
            serverName: "scape",
            maxPlayers: 2047,
            playerCount: 12,
            publicWsUrl: "wss://scape-96cxt.sevalla.app",
        })).toEqual([
            {
                id: 1,
                name: "scape",
                address: "scape-96cxt.sevalla.app",
                secure: true,
                maxPlayers: 2047,
                playerCount: 12,
                location: 0,
                activity: "scape",
                properties: 0,
                description: "Primary world served by this game application.",
            },
        ]);
    });

    test("falls back to request host details when no public websocket URL is set", () => {
        expect(buildWorldDirectory({
            serverName: "Local Development",
            maxPlayers: 2047,
            playerCount: 0,
            hostHeader: "localhost:43594",
            forwardedProto: "http",
        })[0]).toMatchObject({
            address: "localhost:43594",
            secure: false,
            name: "Local Development",
        });
    });

    test("returns normalized explicit directory entries when provided", () => {
        expect(buildWorldDirectory({
            serverName: "ignored",
            maxPlayers: 2047,
            playerCount: 99,
            publicWsUrl: "wss://ignored.example.com",
            rawDirectoryJson: JSON.stringify([
                {
                    id: 301,
                    name: "Production",
                    address: "wss://scape-96cxt.sevalla.app/socket",
                    activity: "Main world",
                    location: 0,
                    properties: 1,
                },
                {
                    name: "Invalid",
                    address: "",
                },
                {
                    name: "Staging",
                    address: "stage.example.com/play",
                    secure: true,
                },
            ]),
        })).toEqual([
            {
                id: 301,
                name: "Production",
                address: "scape-96cxt.sevalla.app",
                secure: true,
                maxPlayers: 2047,
                playerCount: null,
                location: 0,
                activity: "Main world",
                properties: 1,
                description: undefined,
            },
            {
                id: 302,
                name: "Staging",
                address: "stage.example.com",
                secure: true,
                maxPlayers: 2047,
                playerCount: null,
                location: 0,
                activity: "-",
                properties: 0,
                description: undefined,
            },
        ]);
    });
});
