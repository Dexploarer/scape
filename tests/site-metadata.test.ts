import { describe, expect, test } from "bun:test";
import path from "node:path";

const publicDir = path.join(process.cwd(), "public");

async function readPublicFile(filename: string): Promise<string> {
    return await Bun.file(path.join(publicDir, filename)).text();
}

describe("site metadata", () => {
    test("brands the static html shell as -scape", async () => {
        const html = await readPublicFile("index.html");

        expect(html).toContain("<title>-scape | Browser MMO Worlds</title>");
        expect(html).toContain('name="application-name" content="-scape"');
        expect(html).toContain('name="apple-mobile-web-app-title" content="-scape"');
        expect(html).toContain('name="description"');
        expect(html).toContain("browser MMO sandbox");
        expect(html).toContain('property="og:site_name" content="-scape"');
        expect(html).toContain('property="og:title" content="-scape | Browser MMO Worlds"');
        expect(html).toContain('name="twitter:title" content="-scape | Browser MMO Worlds"');
        expect(html).toContain('%PUBLIC_URL%/favicon.svg');
    });

    test("brands the install manifest as -scape", async () => {
        const manifest = JSON.parse(await readPublicFile("manifest.json")) as {
            name: string;
            short_name: string;
            description: string;
            icons: Array<{ src: string; type: string }>;
        };

        expect(manifest.name).toBe("-scape");
        expect(manifest.short_name).toBe("-scape");
        expect(manifest.description).toContain("-scape");
        expect(manifest.icons).toEqual([
            {
                src: "favicon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
            },
        ]);
    });

    test("bumps the shell cache key so new metadata is served after deploy", async () => {
        const serviceWorker = await readPublicFile("service-worker.js");

        expect(serviceWorker).toContain('const CACHE_NAME = "scape-shell-v2";');
    });
});
