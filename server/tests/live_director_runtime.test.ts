import assert from "assert";

import { LiveDirectorRuntime } from "../src/gm/runtime/LiveDirectorRuntime";
import type { LiveDirectorTemplateDefinition } from "../src/gm/types";

function createTemplate(id: string): LiveDirectorTemplateDefinition {
    return {
        id,
        category: "regional-surge",
        displayName: "Test Template",
        announceText: "announce",
        activeText: "active",
        completeText: "complete",
        phaseDurations: {
            announce: 2,
            warmup: 2,
            active: 2,
            cooldown: 2,
            cleanup: 2,
        },
        cooldownTicks: 10,
        minOnlinePlayers: 1,
    };
}

function testPhaseProgression(): void {
    const runtime = new LiveDirectorRuntime();
    const template = createTemplate("test_template");
    const templates = new Map<string, LiveDirectorTemplateDefinition>([[template.id, template]]);

    const started = runtime.startEvent({
        template,
        tick: 100,
        actor: "test",
        reason: "runtime test",
    });

    assert.ok(started, "event should start");
    assert.equal(started?.phase, "announce");

    let transitions = runtime.processTick(102, templates);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].nextPhase, "warmup");

    transitions = runtime.processTick(104, templates);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].nextPhase, "active");

    transitions = runtime.processTick(106, templates);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].nextPhase, "cooldown");

    transitions = runtime.processTick(108, templates);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].nextPhase, "cleanup");

    transitions = runtime.processTick(110, templates);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].kind, "completed");

    assert.equal(runtime.hasActiveEvent(), false);
}

function main(): void {
    testPhaseProgression();
    console.log("\n✓ live director runtime phase progression");
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
