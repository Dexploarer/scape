import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const BROWSER_ENV_FILES = [
    "src/client/assetSources.ts",
    "src/client/login/serverListSources.ts",
    "src/client/login/worldDirectory.ts",
    "src/util/serverDefaults.ts",
    "src/network/ServerConnection.ts",
];
const repoRoot = resolve(import.meta.dir, "..");

describe("browser env contracts", () => {
    test("browser bundles do not use dynamic process.env key access", async () => {
        for (const relativePath of BROWSER_ENV_FILES) {
            const filePath = resolve(repoRoot, relativePath);
            const source = await Bun.file(filePath).text();
            expect(source).not.toContain("process.env[key]");
        }
    });
});
