import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(relativePath: string): string {
    return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
}

describe("connection path contracts", () => {
    test("the main websocket server keeps routing agent traffic through /botsdk", () => {
        const wsServerSource = readRepoFile("server/src/network/wsServer.ts");

        expect(wsServerSource).toContain('if (pathname === "/botsdk")');
        expect(wsServerSource).toContain("(main=/, bot-sdk=/botsdk)");
    });

    test("local browser agent auto-login stays loopback-only and targets localhost:43594", () => {
        const clientSource = readRepoFile("src/client/OsrsClient.ts");

        expect(clientSource).toContain('const autoplayParam = params.get("autoplay")');
        expect(clientSource).toContain('setServerUrl("ws://localhost:43594")');
        expect(clientSource).toContain("[auto-login] ignored: cannot auto-login against a non-loopback origin");
    });
});
