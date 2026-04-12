import { describe, expect, test } from "bun:test";

import { readDevLoginLocConfigFromEnv } from "../server/gamemodes/vanilla/devLoginLoc";

describe("readDevLoginLocConfigFromEnv", () => {
    test("returns undefined when the feature flag is disabled", () => {
        expect(readDevLoginLocConfigFromEnv({})).toBeUndefined();
        expect(readDevLoginLocConfigFromEnv({ SCAPE_DEV_LOGIN_LOC: "0" })).toBeUndefined();
    });

    test("returns Lumbridge defaults when enabled without overrides", () => {
        expect(
            readDevLoginLocConfigFromEnv({
                SCAPE_DEV_LOGIN_LOC: "1",
            }),
        ).toEqual({
            locId: 4387,
            x: 3224,
            y: 3218,
            level: 0,
            shape: 10,
            rotation: 0,
        });
    });

    test("applies valid overrides and normalizes rotation", () => {
        expect(
            readDevLoginLocConfigFromEnv({
                SCAPE_DEV_LOGIN_LOC: "true",
                SCAPE_DEV_LOGIN_LOC_ID: "11338",
                SCAPE_DEV_LOGIN_LOC_X: "3225",
                SCAPE_DEV_LOGIN_LOC_Y: "3219",
                SCAPE_DEV_LOGIN_LOC_LEVEL: "0",
                SCAPE_DEV_LOGIN_LOC_SHAPE: "22",
                SCAPE_DEV_LOGIN_LOC_ROTATION: "5",
            }),
        ).toEqual({
            locId: 11338,
            x: 3225,
            y: 3219,
            level: 0,
            shape: 22,
            rotation: 1,
        });
    });

    test("falls back when overrides are invalid", () => {
        expect(
            readDevLoginLocConfigFromEnv({
                SCAPE_DEV_LOGIN_LOC: "yes",
                SCAPE_DEV_LOGIN_LOC_ID: "-1",
                SCAPE_DEV_LOGIN_LOC_X: "north",
                SCAPE_DEV_LOGIN_LOC_Y: "",
                SCAPE_DEV_LOGIN_LOC_LEVEL: "-2",
                SCAPE_DEV_LOGIN_LOC_SHAPE: "-1",
                SCAPE_DEV_LOGIN_LOC_ROTATION: "west",
            }),
        ).toEqual({
            locId: 4387,
            x: 3224,
            y: 3218,
            level: 0,
            shape: 10,
            rotation: 0,
        });
    });
});
