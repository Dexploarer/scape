import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(relativePath: string): string {
    return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
}

describe("CI workflow contracts", () => {
    test("ci workflow runs the repo-wide test and build gate through the shared bootstrap action", () => {
        const workflow = readRepoFile(".github/workflows/ci.yml");

        expect(workflow).toContain("pull_request:");
        expect(workflow).toContain("uses: ./.github/actions/setup-bun");
        expect(workflow).toContain("bun test tests/*.test.ts");
        expect(workflow).toContain("bun run server:build");
        expect(workflow).toContain("bun run spacetimedb:build");
        expect(workflow).toContain("bun run build");
        expect(workflow).toContain("bun run docs:build");
    });

    test("docs workflow reuses the shared bootstrap action instead of mutating dependencies at runtime", () => {
        const workflow = readRepoFile(".github/workflows/docs.yml");

        expect(workflow).toContain("branches: [main]");
        expect(workflow).toContain("workflow_dispatch:");
        expect(workflow).toContain("uses: ./.github/actions/setup-bun");
        expect(workflow).toContain("bun run docs:build");
        expect(workflow).not.toContain("bun add -D vitepress");
    });

    test("shared workflow bootstrap pins the repo's canonical Bun and Node versions", () => {
        const action = readRepoFile(".github/actions/setup-bun/action.yml");

        expect(action).toContain("node-version: 20");
        expect(action).toContain("bun-version: 1.3.12");
        expect(action).toContain("bun install --frozen-lockfile");
    });
});
