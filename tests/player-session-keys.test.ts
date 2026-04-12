import { describe, expect, test } from "bun:test";

import {
    buildPlayerSaveKey,
    buildScopedPlayerSaveKey,
    normalizePlayerAccountName,
    normalizeWorldScopeId,
} from "../server/src/game/state/PlayerSessionKeys";

describe("PlayerSessionKeys", () => {
    test("normalizes account names", () => {
        expect(normalizePlayerAccountName("  Alice  ")).toBe("alice");
        expect(normalizePlayerAccountName("")).toBeUndefined();
    });

    test("normalizes world scope ids", () => {
        expect(normalizeWorldScopeId("  Toon World!!  ")).toBe("toon-world");
        expect(normalizeWorldScopeId("")).toBeUndefined();
    });

    test("builds hosted world-character save keys", () => {
        expect(
            buildScopedPlayerSaveKey({
                worldId: "Toonscape",
                name: "Alice",
                id: 12,
                worldCharacterId: "Toon-77",
            }),
        ).toBe("world:toonscape:character:toon-77");
    });

    test("builds world-scoped name and id keys", () => {
        expect(buildScopedPlayerSaveKey({ worldId: "scape", name: "Alice", id: 12 })).toBe(
            "world:scape:name:alice",
        );
        expect(buildScopedPlayerSaveKey({ worldId: "scape", id: 12 })).toBe(
            "world:scape:id:12",
        );
    });

    test("preserves the legacy unscoped helper", () => {
        expect(buildPlayerSaveKey("Alice", 12)).toBe("alice");
        expect(buildPlayerSaveKey(undefined, 12)).toBe("id:12");
    });
});
