import { describe, expect, test } from "bun:test";

import {
    buildLocalPrincipalId,
    buildLocalWorldCharacterId,
    resolveSpacetimeStateIds,
} from "../server/src/game/state/SpacetimeStateIds";

describe("SpacetimeStateIds", () => {
    test("derives local principal and world character ids from name-scoped save keys", () => {
        const resolved = resolveSpacetimeStateIds("world:toonscape:name:alice");

        expect(resolved.worldId).toBe("toonscape");
        expect(resolved.principalId).toBe(buildLocalPrincipalId("alice"));
        expect(resolved.worldCharacterId).toBe(
            buildLocalWorldCharacterId("toonscape", "name", "alice"),
        );
        expect(resolved.canonicalName).toBe("alice");
    });

    test("preserves hosted principal and world character hints", () => {
        const resolved = resolveSpacetimeStateIds("world:toonscape:character:toon-77", {
            displayName: "Toon Agent",
            principalId: "principal:agent-77",
            worldCharacterId: "toon-77",
        });

        expect(resolved.principalId).toBe("principal:agent-77");
        expect(resolved.worldCharacterId).toBe("toon-77");
        expect(resolved.displayName).toBe("Toon Agent");
        expect(resolved.branchKind).toBe("hosted");
    });
});
