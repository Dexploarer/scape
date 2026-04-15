import { describe, expect, test } from "bun:test";

import {
    safeJsonStringify,
    safeJsonStringifyOptional,
} from "../server/src/utils/safeJsonStringify";

describe("safeJsonStringify", () => {
    test("stringifies ordinary JSON payloads", () => {
        expect(safeJsonStringify({ ok: true, count: 2 })).toBe('{"ok":true,"count":2}');
    });

    test("falls back to a serialization error payload for circular structures", () => {
        const payload: { self?: unknown } = {};
        payload.self = payload;

        expect(JSON.parse(safeJsonStringify(payload))).toEqual({
            serializationError: expect.any(String),
        });
    });

    test("preserves undefined for optional fields", () => {
        expect(safeJsonStringifyOptional(undefined)).toBeUndefined();
        expect(safeJsonStringifyOptional({ step: 1 })).toBe('{"step":1}');
    });
});
