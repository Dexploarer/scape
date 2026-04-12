import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");

function readRepoFile(relativePath: string): string {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("spacetimedb control-plane scaffold", () => {
    test("package scripts and dependency expose the module build gate", () => {
        const packageJson = JSON.parse(readRepoFile("package.json")) as {
            scripts: Record<string, string>;
            devDependencies: Record<string, string>;
        };

        expect(packageJson.scripts["spacetimedb:build"]).toBe("tsc -p spacetimedb/tsconfig.json");
        expect(packageJson.scripts["ci:verify"]).toContain("bun run spacetimedb:build");
        expect(packageJson.devDependencies.spacetimedb).toBe("2.1.0");
    });

    test("module defines the canonical hosted-world tables and scheduled/event paths", () => {
        const source = readRepoFile("spacetimedb/src/index.ts");

        expect(source).toContain("const world = table(");
        expect(source).toContain("const principal = table(");
        expect(source).toContain("const login_account = table(");
        expect(source).toContain("const world_character = table(");
        expect(source).toContain("const player_snapshot = table(");
        expect(source).toContain("const trajectory_episode = table(");
        expect(source).toContain("const trajectory_step = table(");
        expect(source).toContain("const live_event = table(");
        expect(source).toContain("event: true");
        expect(source).toContain("const scheduled_job = table(");
        expect(source).toContain("scheduled: () => drain_scheduled_job");
        expect(source).toContain("const world_package = table(");
        expect(source).toContain("const world_release = table(");
        expect(source).toContain("const world_patch = table(");
        expect(source).toContain("const prefab = table(");
    });

    test("publish instructions live with the module scaffold", () => {
        const readme = readRepoFile("spacetimedb/README.md");

        expect(readme).toContain("bun run spacetimedb:build");
        expect(readme).toContain("spacetime publish <database-name>");
        expect(readme).toContain("SPACETIMEDB_URI");
        expect(readme).toContain("SPACETIMEDB_DATABASE");
    });
});
