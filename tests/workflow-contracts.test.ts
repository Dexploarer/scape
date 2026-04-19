import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");

function readRepoFile(relativePath: string): string {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("workflow contracts", () => {
    test("CI workflow runs the canonical Bun verification gates on the shared bootstrap", () => {
        const source = readRepoFile(".github/workflows/ci.yml");

        expect(source).toContain("pull_request:");
        expect(source).toContain("push:");
        expect(source).toContain("uses: actions/checkout@v4");
        expect(source).toContain("uses: ./.github/actions/setup-bun");
        expect(source).toContain("run: bun test tests/*.test.ts");
        expect(source).toContain("run: bun run server:build");
        expect(source).toContain("run: bun run spacetimedb:build");
        expect(source).toContain("run: bun run build");
        expect(source).toContain("run: bun run docs:build");
    });

    test("docs deployment follows the shared setup and tracks the real default branch", () => {
        const source = readRepoFile(".github/workflows/docs.yml");

        expect(source).toContain("branches: [main]");
        expect(source).toContain("workflow_dispatch:");
        expect(source).toContain("uses: actions/checkout@v4");
        expect(source).toContain("uses: ./.github/actions/setup-bun");
        expect(source).toContain("run: bun run docs:build");
        expect(source).toContain("uses: actions/upload-pages-artifact@v3");
        expect(source).toContain("uses: actions/deploy-pages@v4");
    });

    test("shared Bun setup action pins the toolchain and installs from lockfile", () => {
        const source = readRepoFile(".github/actions/setup-bun/action.yml");

        expect(source).toContain("node-version: 20");
        expect(source).toContain("bun-version: 1.3.12");
        expect(source).toContain("uses: actions/setup-node@v4");
        expect(source).toContain("uses: oven-sh/setup-bun@v2");
        expect(source).toContain("run: bun install --frozen-lockfile");
    });
});
