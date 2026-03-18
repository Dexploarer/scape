import assert from "assert";

import { composeLiveDirectorPrompt } from "../src/gm/prompts/PromptComposer";

function testPromptComposition(): void {
    const bundle = composeLiveDirectorPrompt({
        seasonId: "leagues_v",
        promptVersion: "2026-02-07.1",
        basePrompt: "base rules",
        seasonPrompt: "season rules",
        hotfixPrompt: "hotfix rules",
        telemetry: {
            tick: 123,
            onlinePlayers: 5,
            npcCount: 42,
        },
        activeTemplateId: "regional_surge_lumbridge",
    });

    assert.equal(bundle.seasonId, "leagues_v");
    assert.equal(bundle.promptVersion, "2026-02-07.1");
    assert.ok(bundle.effectivePrompt.includes("base rules"));
    assert.ok(bundle.effectivePrompt.includes("season rules"));
    assert.ok(bundle.effectivePrompt.includes("hotfix rules"));
    assert.ok(bundle.effectivePrompt.includes("Tick: 123"));
    assert.ok(bundle.effectivePrompt.includes("Active template: regional_surge_lumbridge"));
}

function main(): void {
    testPromptComposition();
    console.log("\n✓ live director prompt composition");
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
