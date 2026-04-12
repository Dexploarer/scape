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
        expect(packageJson.scripts["spacetimedb:generate:bindings"]).toContain(
            "spacetime generate --lang typescript",
        );
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
        expect(source).toContain("scheduled_id: t.u64().primaryKey().autoInc()");
        expect(source).toContain("scheduled_at: t.scheduleAt()");
        expect(source).toContain("const world_package = table(");
        expect(source).toContain("const world_release = table(");
        expect(source).toContain("const world_patch = table(");
        expect(source).toContain("const prefab = table(");
        expect(source).toContain("save_key: t.string().optional()");
    });

    test("module exposes the read procedures the hosted server adapters need", () => {
        const source = readRepoFile("spacetimedb/src/index.ts");

        expect(source).toContain("export const list_login_accounts = control_plane.procedure(");
        expect(source).toContain("export const get_login_account = control_plane.procedure(");
        expect(source).toContain("export const get_world_character_by_save_key = control_plane.procedure(");
        expect(source).toContain("export const get_player_snapshot_by_save_key = control_plane.procedure(");
        expect(source).toContain("export const list_player_snapshots_for_world = control_plane.procedure(");
    });

    test("generated TypeScript bindings are checked in for the control-plane module", () => {
        const bindingsIndex = readRepoFile("server/src/controlplane/module_bindings/index.ts");

        expect(bindingsIndex).toContain("ListLoginAccountsProcedure");
        expect(bindingsIndex).toContain("GetPlayerSnapshotBySaveKeyProcedure");
        expect(bindingsIndex).toContain("UpsertLoginAccountReducer");
    });

    test("publish instructions live with the module scaffold", () => {
        const readme = readRepoFile("spacetimedb/README.md");

        expect(readme).toContain("bun run spacetimedb:build");
        expect(readme).toContain("spacetime publish <database-name>");
        expect(readme).toContain("SPACETIMEDB_URI");
        expect(readme).toContain("SPACETIMEDB_DATABASE");
    });
});
