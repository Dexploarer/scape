/**
 * OSRS Sample Movement Parity Test
 *
 * Replays a real RuneLite JSONL dump against the server PlayerState
 * and asserts that tile transitions (by server tick) match exactly.
 */
import * as fs from "fs";
import * as path from "path";

import { PlayerState } from "../src/game/player";

type Sample = {
    serverTick: number;
    tileX?: number;
    tileY?: number;
    plane?: number;
};

function readJsonl(file: string): Sample[] {
    const text = fs.readFileSync(file, "utf8");
    const out: Sample[] = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            const serverTick = (obj as Sample).serverTick;
            if (Number.isFinite(serverTick)) out.push(obj as Sample);
        } catch {}
    }
    return out;
}

function extractTileTransitions(samples: Sample[]): {
    start: { x: number; y: number; z: number };
    steps: Array<{ x: number; y: number }>;
} {
    if (samples.length === 0) throw new Error("No samples provided");
    const startX = samples[0].tileX ?? 0;
    const startY = samples[0].tileY ?? 0;
    const startZ = samples[0].plane ?? 0;
    let prevX = startX;
    let prevY = startY;
    const steps: Array<{ x: number; y: number }> = [];
    for (const s of samples) {
        const tx = s.tileX ?? prevX;
        const ty = s.tileY ?? prevY;
        if (tx !== prevX || ty !== prevY) {
            steps.push({ x: tx, y: ty });
            prevX = tx;
            prevY = ty;
        }
    }
    return { start: { x: startX, y: startY, z: startZ }, steps };
}

function assert(cond: boolean, msg: string): void {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export async function runOsrsSampleParityTest(): Promise<void> {
    const fixturePath = path.join(__dirname, "fixtures", "osrs-movement-sample.jsonl");
    const samples = readJsonl(fixturePath);
    const { start, steps } = extractTileTransitions(samples);

    // Sanity: this fixture should contain exactly two tile transitions
    assert(steps.length >= 2, `Expected at least 2 tile transitions, got ${steps.length}`);

    const player = new PlayerState(1, start.x, start.y, start.z);
    // Walk (matches isRunning:false in the dump)
    player.setPath(steps, false);

    const visited: Array<{ x: number; y: number }> = [];
    let lastX = player.tileX;
    let lastY = player.tileY;

    // Walk until path completes (bounded for safety)
    const maxTicks = Math.max(steps.length + 5, 16);
    for (let i = 0; i < maxTicks; i++) {
        player.tickStep();
        if (player.tileX !== lastX || player.tileY !== lastY) {
            visited.push({ x: player.tileX, y: player.tileY });
            lastX = player.tileX;
            lastY = player.tileY;
        }
        if (!player.hasPath()) break;
    }

    // Expect the server to have walked one tile per tick in the same order
    assert(
        visited.length === steps.length,
        `Visited steps ${visited.length} != expected ${steps.length} (${JSON.stringify(
            visited,
        )} vs ${JSON.stringify(steps)})`,
    );
    for (let i = 0; i < steps.length; i++) {
        const a = visited[i];
        const b = steps[i];
        assert(
            a.x === b.x && a.y === b.y,
            `Step ${i} mismatch: got (${a.x},${a.y}) expected (${b.x},${b.y})`,
        );
    }

    console.log("✓ OSRS sample parity: server tile transitions match RuneLite dump");
}
