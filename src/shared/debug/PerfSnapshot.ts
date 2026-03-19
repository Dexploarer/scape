export interface PerfValueAggregate {
    avg: number;
    min: number;
    max: number;
    last: number;
    samples: number;
}

export interface PerfPhaseAggregate extends PerfValueAggregate {
    p95: number;
    pct: number;
}

export interface PerfGpuSnapshot {
    avgMs: number;
    p95Ms: number;
    samples: number;
}

export interface PerfMemorySnapshot {
    heapUsedMb: number;
    heapTotalMb: number;
    heapGrowthMb: number;
}

export interface PerformanceProfilerSnapshot {
    source: "current" | "last";
    enabled: boolean;
    verbose: boolean;
    intervalFrames: number;
    avgFrameMs: number;
    p95FrameMs: number;
    p99FrameMs: number;
    minFrameMs: number;
    maxFrameMs: number;
    fps: number;
    fpsTrend: number;
    drawCalls: number;
    triangles: number;
    gpu?: PerfGpuSnapshot;
    memory?: PerfMemorySnapshot;
    phases: Record<string, PerfPhaseAggregate>;
    gauges: Record<string, PerfValueAggregate>;
    allocations: Record<string, number>;
}

export interface ClientPerfSourceSnapshot {
    mobile: boolean;
    ios: boolean;
    touch: boolean;
    userAgent: string;
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
    screenWidth: number;
    screenHeight: number;
    url: string;
}

export interface ClientPerfRenderSnapshot {
    qualityProfile?: string;
    directScenePass?: boolean;
    resolutionScale: number;
    fps: number;
    frameTimeMs: number;
    jsTimeMs: number;
    width: number;
    height: number;
    sceneWidth: number;
    sceneHeight: number;
    drawBatches: number;
    triangles: number;
    vertices: number;
    indices: number;
    geometryGpuBytes: number;
    texturesLoaded: number;
    texturesTotal: number;
    visibleMaps: number;
    loadedMaps: number;
    fpsLimit: number;
    frameBudgetMs: number;
    callbackDeltaMs: number;
    estimatedRefreshHz: number;
    limiterSkippedCallbacks: number;
    limiterSkipDebtMs: number;
    timeoutScheduler: boolean;
    playerTileX: number;
    playerTileY: number;
    playerLevel: number;
    cameraPosX: number;
    cameraPosY: number;
    cameraPosZ: number;
    cameraPitchRs: number;
    cameraYawRs: number;
    cameraRollRs: number;
}

export interface ClientPerfSnapshot {
    capturedAtIso: string;
    source: ClientPerfSourceSnapshot;
    render: ClientPerfRenderSnapshot;
    profiler?: PerformanceProfilerSnapshot | null;
    notes?: string[];
}
