import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

async function readText(path: string): Promise<string> {
    return Bun.file(path).text();
}

const repoRoot = resolve(import.meta.dir, "..");

describe("branding metadata", () => {
    test("uses the scape repo and package identity", async () => {
        const pkg = JSON.parse(await readText(resolve(repoRoot, "package.json")));

        expect(pkg.name).toBe("scape");
        expect(pkg.repository?.url).toBe("https://github.com/Dexploarer/scape");
    });

    test("uses -scape in the installable app manifest and html shell", async () => {
        const manifest = JSON.parse(await readText(resolve(repoRoot, "public/manifest.json")));
        const indexHtml = await readText(resolve(repoRoot, "public/index.html"));

        expect(manifest.name).toBe("-scape");
        expect(manifest.short_name).toBe("-scape");
        expect(manifest.description).toContain("-scape");

        expect(indexHtml).toContain("<title>-scape | Browser MMO Worlds</title>");
        expect(indexHtml).toContain('content="-scape is a browser MMO sandbox for humans and autonomous agents."');
        expect(indexHtml).not.toContain("xRSPS");
        expect(indexHtml).not.toContain("OSRS Client");
    });

    test("uses -scape in the main visible client copy", async () => {
        const loginRenderer = await readText(resolve(repoRoot, "src/client/login/LoginRenderer.ts"));
        const clientApp = await readText(resolve(repoRoot, "src/client/OsrsClientApp.tsx"));
        const sidebarPlugin = await readText(
            resolve(repoRoot, "src/client/plugins/pluginhub/SidebarPlugin.tsx"),
        );
        const sidebarShell = await readText(resolve(repoRoot, "src/client/sidebar/SidebarShell.tsx"));
        const serverConnection = await readText(resolve(repoRoot, "src/network/ServerConnection.ts"));

        expect(loginRenderer).toContain("Welcome to -scape");
        expect(loginRenderer).not.toContain("Welcome to xRSPS");

        expect(clientApp).toContain("Install -scape");
        expect(clientApp).toContain("Add -scape to your home screen");
        expect(clientApp).not.toContain("Install OSRS Client");

        expect(sidebarPlugin).toContain('title: "-scape"');
        expect(sidebarShell).toContain("Plugin is currently disabled in -scape.");
        expect(sidebarShell).toContain('<div className="rl-sidebar-panel-title">-scape</div>');
        expect(sidebarShell).toContain('<div className="rl-sidebar-heading-kicker">-scape</div>');
        expect(sidebarShell).not.toContain("xRSPS");

        expect(serverConnection).toContain('client: "scape-web"');
        expect(serverConnection).not.toContain('client: "osrs-typescript"');
    });
});
