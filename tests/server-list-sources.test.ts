import { describe, expect, test } from "bun:test";

import {
    buildDefaultServerDirectoryUrl,
    DEVELOPMENT_SERVER_LIST_PATH,
    getServerListUrls,
    loadServerListEntries,
    PRODUCTION_SERVER_LIST_PATH,
} from "../src/client/login/serverListSources";

describe("serverListSources", () => {
    test("uses the development feed for localhost defaults", () => {
        expect(
            getServerListUrls(
                {
                    address: "localhost:43594",
                    secure: false,
                },
                undefined,
            ),
        ).toEqual([DEVELOPMENT_SERVER_LIST_PATH]);
    });

    test("uses the production feed and live fallback for hosted defaults", () => {
        expect(
            getServerListUrls(
                {
                    address: "scape-96cxt.sevalla.app",
                    secure: true,
                },
                undefined,
            ),
        ).toEqual([
            PRODUCTION_SERVER_LIST_PATH,
            buildDefaultServerDirectoryUrl({
                address: "scape-96cxt.sevalla.app",
                secure: true,
            }),
        ]);
    });

    test("prefers an explicit server-list override", () => {
        expect(
            getServerListUrls(
                {
                    address: "localhost:43594",
                    secure: false,
                },
                "https://directory.example.com/worlds.json",
            ),
        ).toEqual(["https://directory.example.com/worlds.json"]);
    });

    test("skips html fallback responses and continues to the next server list source", async () => {
        const calls: string[] = [];
        const fetchImpl = (async (url: string) => {
            calls.push(url);
            if (url.includes("broken")) {
                return {
                    ok: true,
                    headers: new Headers({
                        "content-type": "text/html; charset=utf-8",
                    }),
                    text: async () => '<html lang="en"><head><title>404</title></head></html>',
                } as Response;
            }

            return {
                ok: true,
                headers: new Headers({
                    "content-type": "application/json; charset=utf-8",
                }),
                text: async () =>
                    JSON.stringify([
                        {
                            name: "scape",
                            address: "scape-96cxt.sevalla.app",
                            secure: true,
                            maxPlayers: 2047,
                        },
                    ]),
            } as Response;
        }) as typeof fetch;

        await expect(
            loadServerListEntries(
                [
                    "https://directory.example.com/broken.json",
                    "https://directory.example.com/worlds.json",
                ],
                fetchImpl,
            ),
        ).resolves.toEqual([
            {
                name: "scape",
                address: "scape-96cxt.sevalla.app",
                secure: true,
                maxPlayers: 2047,
            },
        ]);

        expect(calls).toEqual([
            "https://directory.example.com/broken.json",
            "https://directory.example.com/worlds.json",
        ]);
    });

    test("skips invalid json bodies even when the response is marked successful", async () => {
        const fetchImpl = (async () =>
            ({
                ok: true,
                headers: new Headers({
                    "content-type": "application/json; charset=utf-8",
                }),
                text: async () => "<html lang=\"en\">not json</html>",
            }) as Response) as typeof fetch;

        await expect(
            loadServerListEntries(["https://directory.example.com/worlds.json"], fetchImpl),
        ).resolves.toEqual([]);
    });
});
