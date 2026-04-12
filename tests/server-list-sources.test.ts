import { describe, expect, test } from "bun:test";

import {
    buildDefaultServerDirectoryUrl,
    DEVELOPMENT_SERVER_LIST_PATH,
    getServerListUrls,
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
});
