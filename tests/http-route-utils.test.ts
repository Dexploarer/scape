import { describe, expect, test } from "bun:test";

import { getRequestPathname } from "../server/src/network/HttpRouteUtils";

describe("getRequestPathname", () => {
    test("returns the pathname for bare routes", () => {
        expect(getRequestPathname("/status")).toBe("/status");
        expect(getRequestPathname("/servers.json")).toBe("/servers.json");
    });

    test("strips query strings from route matches", () => {
        expect(getRequestPathname("/status?cb=abc123")).toBe("/status");
        expect(getRequestPathname("/servers.json?cb=abc123")).toBe("/servers.json");
        expect(getRequestPathname("/worlds?foo=bar&cb=abc123")).toBe("/worlds");
    });

    test("falls back to the root path for empty values", () => {
        expect(getRequestPathname(undefined)).toBe("/");
    });
});
