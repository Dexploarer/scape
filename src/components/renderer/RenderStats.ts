export class RenderStats {
    frameCount: number = 0;

    frameTime: number = 0;
    frameTimeFps: number = 0;

    lastFrameTime: DOMHighResTimeStamp | undefined;

    frameTimeStart: number = 0;
    frameTimeJs: number = 0;

    // 1-second FPS averaging
    private fpsFrameCount: number = 0;
    private fpsAccumulatedTime: number = 0;
    private fpsLastUpdate: DOMHighResTimeStamp = 0;

    // Rendering aggregates (updated by renderer each frame)
    // Geometry submission (per-frame)
    drawBatches: number = 0; // number of draw ranges submitted
    indicesSubmitted: number = 0; // index elements submitted this frame
    trianglesSubmitted: number = 0; // indices/3 (approx)
    verticesSubmitted: number = 0; // approx = indicesSubmitted for TRIANGLES

    // Scene visibility
    visibleMaps: number = 0;
    loadedMaps: number = 0;

    // Resources
    geometryGpuBytes: number = 0; // visible + resident geometry buffers
    texturesLoaded: number = 0; // resident texture layers
    texturesTotal: number = 0; // total possible layers in array

    // Output resolution
    width: number = 0;
    height: number = 0;
    sceneWidth: number = 0;
    sceneHeight: number = 0;

    // Frame pacing / scheduler diagnostics
    frameBudgetMs: number = 0;
    callbackDeltaMs: number = 0;
    limiterSkippedCallbacks: number = 0;
    limiterSkipDebtMs: number = 0;
    estimatedRefreshHz: number = 0;
    usedTimeoutScheduler: boolean = false;

    // Camera + Player debug fields
    cameraPosX: number = 0;
    cameraPosY: number = 0;
    cameraPosZ: number = 0;

    cameraPitchRS: number = 0; // RS units (0..2047)
    cameraYawRS: number = 0; // RS units (0..2047)
    cameraRollRS: number = 0; // RS units (0..2047)

    playerTileX: number = 0;
    playerTileY: number = 0;
    playerLevel: number = 0;

    private lastCallbackTime: DOMHighResTimeStamp | undefined;
    private pendingLimiterSkippedCallbacks: number = 0;
    private pendingLimiterSkipDebtMs: number = 0;

    noteFrameCallback(
        time: DOMHighResTimeStamp,
        opts?: { viaTimeout?: boolean; frameBudgetMs?: number },
    ): void {
        const delta = this.lastCallbackTime === undefined ? 0 : time - this.lastCallbackTime;
        this.lastCallbackTime = time;
        this.callbackDeltaMs = delta > 0 ? delta : 0;
        this.usedTimeoutScheduler = !!opts?.viaTimeout;
        this.frameBudgetMs = Math.max(0, opts?.frameBudgetMs ?? 0);

        // Track the active display cadence from visible RAF callbacks.
        if (!opts?.viaTimeout && delta >= 4 && delta <= 40) {
            const hz = 1000 / delta;
            if (this.estimatedRefreshHz <= 0) {
                this.estimatedRefreshHz = hz;
            } else {
                this.estimatedRefreshHz = this.estimatedRefreshHz * 0.85 + hz * 0.15;
            }
        }
    }

    noteLimiterSkip(skipDebtMs: number): void {
        this.pendingLimiterSkippedCallbacks++;
        this.pendingLimiterSkipDebtMs += Math.max(0, skipDebtMs);
    }

    getDeltaTime(time: DOMHighResTimeStamp): number {
        return time - (this.lastFrameTime ?? time);
    }

    update(time: DOMHighResTimeStamp) {
        this.frameTime = this.getDeltaTime(time);
        this.lastFrameTime = time;
        this.frameTimeStart = performance.now();
        this.limiterSkippedCallbacks = this.pendingLimiterSkippedCallbacks;
        this.limiterSkipDebtMs = this.pendingLimiterSkipDebtMs;
        this.pendingLimiterSkippedCallbacks = 0;
        this.pendingLimiterSkipDebtMs = 0;

        // 1-second average FPS
        this.fpsFrameCount++;
        this.fpsAccumulatedTime += this.frameTime;
        const elapsed = time - this.fpsLastUpdate;
        if (elapsed >= 1000) {
            this.frameTimeFps = (this.fpsFrameCount * 1000) / this.fpsAccumulatedTime;
            this.fpsFrameCount = 0;
            this.fpsAccumulatedTime = 0;
            this.fpsLastUpdate = time;
        }
    }

    onFrameEnd() {
        this.frameCount++;
        if (this.lastFrameTime !== undefined) {
            this.frameTimeJs = performance.now() - this.frameTimeStart;
        }
    }
}
