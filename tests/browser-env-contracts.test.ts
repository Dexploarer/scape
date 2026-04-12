import { describe, expect, test } from "bun:test";

const BROWSER_ENV_FILES = [
    "/Users/home/-scape/src/client/assetSources.ts",
    "/Users/home/-scape/src/client/login/serverListSources.ts",
    "/Users/home/-scape/src/client/login/worldDirectory.ts",
    "/Users/home/-scape/src/util/serverDefaults.ts",
    "/Users/home/-scape/src/network/ServerConnection.ts",
];

describe("browser env contracts", () => {
    test("browser bundles do not use dynamic process.env key access", async () => {
        for (const filePath of BROWSER_ENV_FILES) {
            const source = await Bun.file(filePath).text();
            expect(source).not.toContain("process.env[key]");
        }
    });
});
