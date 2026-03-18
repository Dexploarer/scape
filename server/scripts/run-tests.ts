import fs from "fs";
import path from "path";

function listTestFiles(dir: string): string[] {
    const out: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...listTestFiles(p));
        else if (e.isFile() && p.endsWith(".ts")) out.push(p);
    }
    return out;
}

async function main() {
    const testsDir = path.resolve(process.cwd(), "server/tests");
    if (!fs.existsSync(testsDir)) {
        console.log("No server/tests directory found; nothing to run.");
        return;
    }
    const files = listTestFiles(testsDir).sort();
    if (files.length === 0) {
        console.log("No server tests found.");
        return;
    }
    let failed = 0;
    for (const f of files) {
        const rel = path.relative(process.cwd(), f);
        console.log(`\nRunning ${rel}`);
        try {
            // ts-node/register/transpile-only is preloaded by the npm script
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require(f);
        } catch (e: any) {
            failed++;
            console.error(`Test failed: ${rel}`);
            console.error(e?.stack || String(e));
        }
    }
    if (failed > 0) {
        console.error(`\n${failed} server test(s) failed.`);
        process.exit(1);
    } else {
        console.log(`\nAll ${files.length} server test(s) passed.`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
