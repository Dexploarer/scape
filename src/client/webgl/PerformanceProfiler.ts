/**
 * Performance profiler that tracks timing for various render phases
 * and logs stats every second to help diagnose performance issues.
 */
export class PerformanceProfiler {
    enabled: boolean = false;
    verbose: boolean = false;

    // Timing accumulators (reset every second)
    private frameCount: number = 0;
    private totalFrameTime: number = 0;
    private maxFrameTime: number = 0;
    private minFrameTime: number = Infinity;
    private frameSamples: number[] = [];

    // Phase timings
    private phases: Map<
        string,
        {
            total: number;
            count: number;
            max: number;
            samples: number[];
        }
    > = new Map();

    // Memory tracking
    private lastHeapUsed: number = 0;
    private heapGrowth: number = 0;
    private heapDeltaHistory: number[] = [];
    private heapUsedHistory: number[] = [];
    private readonly HEAP_TREND_WINDOW = 12;

    // GPU stats
    private drawCalls: number = 0;
    private triangles: number = 0;

    // Allocation tracking
    private allocations: Map<string, number> = new Map();
    private gauges: Map<
        string,
        { total: number; count: number; min: number; max: number; last: number }
    > = new Map();

    // Timing
    private lastLogTime: number = performance.now();
    private currentPhase: string | null = null;
    private phaseStartTime: number = 0;

    // History for trend detection
    private fpsHistory: number[] = [];
    private readonly MAX_HISTORY = 60; // 60 seconds of history

    constructor() {
        this.reset();
    }

    reset(): void {
        this.frameCount = 0;
        this.totalFrameTime = 0;
        this.maxFrameTime = 0;
        this.minFrameTime = Infinity;
        this.frameSamples.length = 0;
        this.phases.clear();
        this.drawCalls = 0;
        this.triangles = 0;
        this.allocations.clear();
        this.gauges.clear();
    }

    startFrame(): void {
        if (!this.enabled) return;
        this.phaseStartTime = performance.now();
    }

    endFrame(frameTime: number): void {
        if (!this.enabled) return;

        this.frameCount++;
        this.totalFrameTime += frameTime;
        this.maxFrameTime = Math.max(this.maxFrameTime, frameTime);
        this.minFrameTime = Math.min(this.minFrameTime, frameTime);
        this.frameSamples.push(frameTime);

        // Check if 1 second has passed
        const now = performance.now();
        if (now - this.lastLogTime >= 1000) {
            this.logStats();
            this.lastLogTime = now;
        }
    }

    startPhase(name: string): void {
        if (!this.enabled) return;
        this.currentPhase = name;
        this.phaseStartTime = performance.now();
    }

    endPhase(): void {
        if (!this.enabled || !this.currentPhase) return;

        const elapsed = performance.now() - this.phaseStartTime;
        let phase = this.phases.get(this.currentPhase);
        if (!phase) {
            phase = { total: 0, count: 0, max: 0, samples: [] };
            this.phases.set(this.currentPhase, phase);
        }
        phase.total += elapsed;
        phase.count++;
        phase.max = Math.max(phase.max, elapsed);
        phase.samples.push(elapsed);
        this.currentPhase = null;
    }

    recordDrawCall(drawCalls: number, triangleCount: number): void {
        if (!this.enabled) return;
        this.drawCalls += drawCalls | 0;
        this.triangles += triangleCount;
    }

    recordAllocation(type: string, count: number = 1): void {
        if (!this.enabled) return;
        this.allocations.set(type, (this.allocations.get(type) ?? 0) + count);
    }

    recordGauge(name: string, value: number): void {
        if (!this.enabled) return;
        let gauge = this.gauges.get(name);
        if (!gauge) {
            gauge = {
                total: 0,
                count: 0,
                min: Number.POSITIVE_INFINITY,
                max: Number.NEGATIVE_INFINITY,
                last: value,
            };
            this.gauges.set(name, gauge);
        }
        gauge.total += value;
        gauge.count++;
        gauge.min = Math.min(gauge.min, value);
        gauge.max = Math.max(gauge.max, value);
        gauge.last = value;
    }

    private percentile(samples: number[], percentile: number): number {
        if (samples.length === 0) return 0;
        if (samples.length === 1) return samples[0];
        const sorted = [...samples].sort((a, b) => a - b);
        const clamped = Math.max(0, Math.min(1, percentile));
        const idx = Math.min(
            sorted.length - 1,
            Math.max(0, Math.floor(clamped * (sorted.length - 1))),
        );
        return sorted[idx];
    }

    private logStats(): void {
        if (this.frameCount === 0) return;

        const avgFrameTime = this.totalFrameTime / this.frameCount;
        const fps = 1000 / avgFrameTime;
        const p95FrameTime = this.percentile(this.frameSamples, 0.95);
        const p99FrameTime = this.percentile(this.frameSamples, 0.99);

        // Track FPS history for trend detection
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.MAX_HISTORY) {
            this.fpsHistory.shift();
        }

        // Detect FPS degradation trend
        let trend = "";
        if (this.fpsHistory.length >= 10) {
            const recent = this.fpsHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
            const older = this.fpsHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
            const diff = recent - older;
            if (diff < -5) trend = " ⚠️ DEGRADING";
            else if (diff > 5) trend = " ✓ improving";
        }

        // Memory stats (if available)
        let memoryStr = "";
        let heapUsedMb: number | undefined;
        let heapTotalMb: number | undefined;
        if ((performance as any).memory) {
            const mem = (performance as any).memory;
            const heapUsed = mem.usedJSHeapSize / 1024 / 1024;
            const heapTotal = mem.totalJSHeapSize / 1024 / 1024;
            heapUsedMb = heapUsed;
            heapTotalMb = heapTotal;
            if (this.lastHeapUsed <= 0) {
                this.heapGrowth = 0;
            } else {
                this.heapGrowth = heapUsed - this.lastHeapUsed;
            }
            this.lastHeapUsed = heapUsed;
            this.heapDeltaHistory.push(this.heapGrowth);
            this.heapUsedHistory.push(heapUsed);
            if (this.heapDeltaHistory.length > this.HEAP_TREND_WINDOW) {
                this.heapDeltaHistory.shift();
            }
            if (this.heapUsedHistory.length > this.HEAP_TREND_WINDOW) {
                this.heapUsedHistory.shift();
            }
            memoryStr = `Heap: ${heapUsed.toFixed(1)}/${heapTotal.toFixed(1)}MB (${
                this.heapGrowth >= 0 ? "+" : ""
            }${this.heapGrowth.toFixed(2)}MB)`;
        }

        // Build phase timing string
        const phaseStrs: string[] = [];
        const sortedPhases = Array.from(this.phases.entries()).sort(
            (a, b) => b[1].total - a[1].total,
        );

        for (const [name, data] of sortedPhases) {
            const avg = data.total / data.count;
            const pct = ((data.total / this.totalFrameTime) * 100).toFixed(1);
            const p95 = this.percentile(data.samples, 0.95);
            phaseStrs.push(
                `${name}: ${avg.toFixed(2)}ms (${pct}%, p95 ${p95.toFixed(
                    2,
                )}ms, max ${data.max.toFixed(2)}ms)`,
            );
        }

        // Build allocation string
        const allocStrs: string[] = [];
        for (const [type, count] of this.allocations) {
            if (count > 0) {
                allocStrs.push(`${type}: ${count}`);
            }
        }

        // Log everything
        console.log(
            `%c[PERF]%c FPS: ${fps.toFixed(1)}${trend} | ` +
                `Frame: ${avgFrameTime.toFixed(2)}ms (p95 ${p95FrameTime.toFixed(
                    2,
                )}, p99 ${p99FrameTime.toFixed(2)}, min ${this.minFrameTime.toFixed(
                    2,
                )}, max ${this.maxFrameTime.toFixed(2)}) | ` +
                `Frames: ${this.frameCount}`,
            "color: #4CAF50; font-weight: bold",
            "color: inherit",
        );

        if (memoryStr) {
            console.log(
                `%c[PERF]%c ${memoryStr}`,
                "color: #4CAF50; font-weight: bold",
                "color: inherit",
            );
        }

        if (this.drawCalls > 0) {
            console.log(
                `%c[PERF]%c Draw calls: ${this.drawCalls} | Triangles: ${(
                    this.triangles / 1000
                ).toFixed(1)}K`,
                "color: #4CAF50; font-weight: bold",
                "color: inherit",
            );
        }

        if (phaseStrs.length > 0) {
            console.log(
                `%c[PERF]%c Phases: ${phaseStrs.join(" | ")}`,
                "color: #4CAF50; font-weight: bold",
                "color: inherit",
            );
        }

        if (allocStrs.length > 0) {
            console.log(
                `%c[PERF]%c Allocations: ${allocStrs.join(", ")}`,
                "color: #FF9800; font-weight: bold",
                "color: inherit",
            );
        }

        if (this.gauges.size > 0) {
            const gaugeStrs: string[] = [];
            for (const [name, gauge] of this.gauges.entries()) {
                const avg = gauge.count > 0 ? gauge.total / gauge.count : 0;
                gaugeStrs.push(
                    `${name}: avg ${avg.toFixed(1)} (last ${gauge.last.toFixed(
                        1,
                    )}, min ${gauge.min.toFixed(1)}, max ${gauge.max.toFixed(1)})`,
                );
            }
            console.log(
                `%c[PERF]%c Gauges: ${gaugeStrs.join(" | ")}`,
                "color: #03A9F4; font-weight: bold",
                "color: inherit",
            );
        }

        // Warn about potential issues
        if (this.maxFrameTime > 50) {
            console.warn(`[PERF] ⚠️ Frame spike detected: ${this.maxFrameTime.toFixed(2)}ms`);
        }

        if (this.heapDeltaHistory.length >= 6 && this.heapUsedHistory.length >= 6) {
            const recentDeltas = this.heapDeltaHistory.slice(-5);
            const positiveDeltas = recentDeltas.filter((delta) => delta > 2).length;
            const recentNetGrowth =
                this.heapUsedHistory[this.heapUsedHistory.length - 1] -
                this.heapUsedHistory[this.heapUsedHistory.length - 6];
            // Warn only for sustained growth to avoid false positives from GC sawtooth patterns.
            if (positiveDeltas >= 4 && recentNetGrowth > 20) {
                console.warn(
                    `[PERF] ⚠️ Sustained memory growth: +${recentNetGrowth.toFixed(2)}MB over ~5s` +
                        (heapUsedMb !== undefined && heapTotalMb !== undefined
                            ? ` | Heap: ${heapUsedMb.toFixed(1)}/${heapTotalMb.toFixed(1)}MB`
                            : ""),
                );
            }
        }

        // Reset for next second
        this.reset();
    }

    // Get current FPS trend (positive = improving, negative = degrading)
    getFpsTrend(): number {
        if (this.fpsHistory.length < 10) return 0;
        const recent = this.fpsHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const older = this.fpsHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
        return recent - older;
    }
}

// Singleton instance
export const profiler = new PerformanceProfiler();

// Expose to window for console access
if (typeof window !== "undefined") {
    (window as any).profiler = profiler;
}
