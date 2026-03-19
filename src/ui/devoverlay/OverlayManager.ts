import { profiler } from "../../client/webgl/PerformanceProfiler";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

// PERF: Per-overlay timing for debugging
const overlayTimings: Map<string, number> = new Map();
let lastLogTime = 0;
const LOG_INTERVAL_MS = 1000;

export class OverlayManager {
    private overlays: Overlay[] = [];

    add(overlay: Overlay): this {
        this.overlays.push(overlay);
        return this;
    }

    init(args: OverlayInitArgs): void {
        for (const ov of this.overlays) ov.init(args);
    }

    update(args: OverlayUpdateArgs): void {
        if (!profiler.enabled) {
            for (const ov of this.overlays) ov.update(args);
            return;
        }

        const start = performance.now();
        for (const ov of this.overlays) ov.update(args);
        profiler.recordGauge("overlayUpdateMs", performance.now() - start);
    }

    draw(phase: RenderPhase): void {
        if (!profiler.enabled) {
            for (const ov of this.overlays) ov.draw(phase);
            return;
        }

        // Profile each overlay
        for (const ov of this.overlays) {
            const name = ov.constructor.name;
            const start = performance.now();
            ov.draw(phase);
            const elapsed = performance.now() - start;
            overlayTimings.set(name, (overlayTimings.get(name) ?? 0) + elapsed);
        }

        // Log breakdown every second
        const now = performance.now();
        if (now - lastLogTime > LOG_INTERVAL_MS) {
            lastLogTime = now;
            if (profiler.verbose && overlayTimings.size > 0) {
                const sorted = [...overlayTimings.entries()]
                    .filter(([_, ms]) => ms > 0.1)
                    .sort((a, b) => b[1] - a[1]);
                const total = sorted.reduce((sum, [_, ms]) => sum + ms, 0);
                const breakdown = sorted
                    .map(
                        ([name, ms]) =>
                            `${name}: ${ms.toFixed(1)}ms (${((ms / total) * 100).toFixed(0)}%)`,
                    )
                    .join(" | ");
                console.log(`[PERF] Overlay breakdown (${total.toFixed(1)}ms total): ${breakdown}`);
            }
            overlayTimings.clear();
        }
    }

    dispose(): void {
        for (const ov of this.overlays) ov.dispose();
        this.overlays = [];
    }
}
