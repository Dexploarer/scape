import React, { useEffect, useRef, useState } from "react";

import { profiler } from "../../client/webgl/PerformanceProfiler";
import type { GameRenderer } from "../../client/GameRenderer";
import { sendPerformanceDebugSnapshot } from "../../network/ServerConnection";
import { RS_TO_DEGREES } from "../../rs/MathConstants";
import type { CacheInfo } from "../../rs/cache/CacheInfo";
import type { ClientPerfSnapshot } from "../../shared/debug/PerfSnapshot";
import { checkIos, checkMobile, isTouchDevice } from "../../util/DeviceUtil";
import { formatBytes } from "../../util/BytesUtil";
import { RenderStats } from "./RenderStats";

export interface RenderStatsOverlayProps {
    renderer: GameRenderer;
    cacheInfo?: CacheInfo;
    showDetails?: boolean;
}

function formatNum(n: number): string {
    return (n ?? 0).toLocaleString();
}

function formatCacheInfo(info?: CacheInfo): string {
    if (!info) {
        return "Not loaded";
    }

    const gameLabel = info.game === "oldschool" ? "OSRS" : info.game.toUpperCase();
    const parts = [gameLabel, info.environment, `rev ${info.revision}`];
    return `${info.name} (${parts.join(" • ")})`;
}

function buildPerfSnapshot(renderer: GameRenderer): ClientPerfSnapshot {
    const s: RenderStats = renderer.stats;
    const notes: string[] = [];
    const profilerSnapshot = profiler.getDebugSnapshot();
    const effectiveScale = renderer.osrsClient.mobileEffectiveResolutionScale ?? 1;
    const directScenePass =
        typeof (renderer as any).shouldUseDirectTextureScenePass === "function"
            ? Boolean((renderer as any).shouldUseDirectTextureScenePass())
            : undefined;
    const qualityProfileKey =
        typeof (renderer as any).getActiveQualityProfileKey === "function"
            ? String((renderer as any).getActiveQualityProfileKey())
            : undefined;
    const qualityProfileLabel =
        typeof (renderer as any).getActiveQualityProfileLabel === "function"
            ? String((renderer as any).getActiveQualityProfileLabel())
            : qualityProfileKey;
    if (!profiler.enabled) {
        notes.push("Profiler disabled; snapshot contains live render stats only.");
    } else if (!profilerSnapshot) {
        notes.push("Profiler enabled but no accumulated snapshot was available yet.");
    }
    if (qualityProfileLabel) {
        notes.push(`Quality profile: ${qualityProfileLabel}`);
    }
    if ((renderer.osrsClient.mobilePerfResolutionScale ?? 0) <= 0) {
        notes.push("Scene scale override: profile default");
    }

    return {
        capturedAtIso: new Date().toISOString(),
        source: {
            mobile: checkMobile(),
            ios: checkIos(),
            touch: isTouchDevice,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            devicePixelRatio:
                typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
                    ? window.devicePixelRatio
                    : 1,
            viewportWidth:
                typeof window !== "undefined" ? Math.max(0, window.innerWidth | 0) : 0,
            viewportHeight:
                typeof window !== "undefined" ? Math.max(0, window.innerHeight | 0) : 0,
            screenWidth:
                typeof window !== "undefined" && window.screen
                    ? Math.max(0, window.screen.width | 0)
                    : 0,
            screenHeight:
                typeof window !== "undefined" && window.screen
                    ? Math.max(0, window.screen.height | 0)
                    : 0,
            url: typeof window !== "undefined" ? window.location.href : "",
        },
        render: {
            qualityProfile: qualityProfileKey,
            directScenePass,
            resolutionScale: effectiveScale,
            fps: s.frameTimeFps,
            frameTimeMs: s.frameTime,
            jsTimeMs: s.frameTimeJs,
            width: s.width | 0,
            height: s.height | 0,
            sceneWidth: s.sceneWidth | 0,
            sceneHeight: s.sceneHeight | 0,
            drawBatches: s.drawBatches | 0,
            triangles: s.trianglesSubmitted | 0,
            vertices: s.verticesSubmitted | 0,
            indices: s.indicesSubmitted | 0,
            geometryGpuBytes: s.geometryGpuBytes | 0,
            texturesLoaded: s.texturesLoaded | 0,
            texturesTotal: s.texturesTotal | 0,
            visibleMaps: s.visibleMaps | 0,
            loadedMaps: s.loadedMaps | 0,
            fpsLimit: s.frameBudgetMs > 0 ? 1000 / s.frameBudgetMs : 0,
            frameBudgetMs: s.frameBudgetMs,
            callbackDeltaMs: s.callbackDeltaMs,
            estimatedRefreshHz: s.estimatedRefreshHz,
            limiterSkippedCallbacks: s.limiterSkippedCallbacks | 0,
            limiterSkipDebtMs: s.limiterSkipDebtMs,
            timeoutScheduler: s.usedTimeoutScheduler,
            playerTileX: s.playerTileX | 0,
            playerTileY: s.playerTileY | 0,
            playerLevel: s.playerLevel | 0,
            cameraPosX: s.cameraPosX,
            cameraPosY: s.cameraPosY,
            cameraPosZ: s.cameraPosZ,
            cameraPitchRs: s.cameraPitchRS | 0,
            cameraYawRs: s.cameraYawRS | 0,
            cameraRollRs: s.cameraRollRS | 0,
        },
        profiler: profilerSnapshot,
        notes,
    };
}

export function RenderStatsOverlay({
    renderer,
    cacheInfo,
    showDetails = true,
}: RenderStatsOverlayProps): JSX.Element {
    const s: RenderStats = renderer.stats;
    const [sendStatus, setSendStatus] = useState("");
    const pendingSendTimerRef = useRef<number | undefined>();
    const resolutionScaleOverride = renderer.osrsClient.mobilePerfResolutionScale ?? 0;
    const effectiveResolutionScale = renderer.osrsClient.mobileEffectiveResolutionScale ?? 1;
    const qualityProfileLabel =
        typeof (renderer as any).getActiveQualityProfileLabel === "function"
            ? String((renderer as any).getActiveQualityProfileLabel())
            : checkIos() && checkMobile()
              ? "iPhone Safari"
              : checkMobile()
                ? "Mobile Browser"
                : "Desktop";

    const fps = Math.round(s.frameTimeFps);
    const jsMs = s.frameTimeJs.toFixed(1);
    const tris = s.trianglesSubmitted;
    const verts = s.verticesSubmitted;

    const size = `${s.width} x ${s.height}`;
    const sceneSize =
        s.sceneWidth > 0 && s.sceneHeight > 0 ? `${s.sceneWidth} x ${s.sceneHeight}` : size;
    const tex = `${s.texturesLoaded}/${s.texturesTotal}`;
    const maps = `${s.visibleMaps} visible • ${s.loadedMaps} loaded`;

    const camPitchDeg = (s.cameraPitchRS * RS_TO_DEGREES).toFixed(2);
    const camYawDeg = (s.cameraYawRS * RS_TO_DEGREES).toFixed(2);
    const camRollDeg = (s.cameraRollRS * RS_TO_DEGREES).toFixed(2);
    const camPos = `${s.cameraPosX.toFixed(2)}, ${s.cameraPosY.toFixed(2)}, ${s.cameraPosZ.toFixed(
        2,
    )}`;
    const playerPos = `${s.playerTileX}, ${s.playerTileY}, lv ${s.playerLevel}`;
    const cacheLabel = formatCacheInfo(cacheInfo);

    useEffect(() => {
        if (!sendStatus) {
            return;
        }
        const timeoutId = window.setTimeout(() => setSendStatus(""), 3000);
        return () => window.clearTimeout(timeoutId);
    }, [sendStatus]);

    useEffect(() => {
        return () => {
            if (pendingSendTimerRef.current !== undefined) {
                window.clearTimeout(pendingSendTimerRef.current);
                pendingSendTimerRef.current = undefined;
            }
        };
    }, []);

    const handleSendPerf = () => {
        if (!profiler.enabled) {
            profiler.enabled = true;
            if (pendingSendTimerRef.current !== undefined) {
                window.clearTimeout(pendingSendTimerRef.current);
            }
            setSendStatus("Sampling 1s...");
            pendingSendTimerRef.current = window.setTimeout(() => {
                pendingSendTimerRef.current = undefined;
                const sent = sendPerformanceDebugSnapshot(buildPerfSnapshot(renderer));
                setSendStatus(sent ? "Sent to server" : "Not connected");
            }, 1200);
            return;
        }
        const sent = sendPerformanceDebugSnapshot(buildPerfSnapshot(renderer));
        setSendStatus(sent ? "Sent to server" : "Not connected");
    };

    const handleTogglePerfScale = () => {
        const next =
            resolutionScaleOverride <= 0
                ? 0.5
                : resolutionScaleOverride <= 0.51
                  ? 1
                  : 0;
        renderer.osrsClient.setMobilePerfResolutionScale(next);
        setSendStatus(
            next <= 0
                ? `Scene Profile (${effectiveResolutionScale.toFixed(2)}x)`
                : `Scene ${next.toFixed(1)}x`,
        );
    };

    return (
        <>
            {showDetails && (
                <div className="hud left-bottom">
                    <div
                        className="content-text"
                        style={{
                            background: "rgba(0,0,0,0.45)",
                            padding: "6px 8px",
                            borderRadius: 4,
                            lineHeight: 1.4,
                            fontSize: 12,
                            color: "#fff",
                            minWidth: 220,
                            pointerEvents: "none",
                        }}
                    >
                        <div>
                            <strong>FPS:</strong> {fps} <span style={{ opacity: 0.7 }}>({jsMs} ms JS)</span>
                        </div>
                        <div>
                            <strong>Canvas:</strong> {size}{" "}
                            <span style={{ opacity: 0.7 }}>Scene: {sceneSize}</span>
                        </div>
                        <div>
                            <strong>Profile:</strong> {qualityProfileLabel}
                        </div>
                        <div>
                            <strong>Triangles:</strong> {formatNum(tris)}{" "}
                            <span style={{ opacity: 0.7 }}>Verts: {formatNum(verts)}</span>
                        </div>
                        <div>
                            <strong>Batches:</strong> {formatNum(s.drawBatches)}{" "}
                            <span style={{ opacity: 0.7 }}>Indices: {formatNum(s.indicesSubmitted)}</span>
                        </div>
                        <div>
                            <strong>Geometry:</strong> {formatBytes(s.geometryGpuBytes)}
                        </div>
                        <div>
                            <strong>Textures:</strong> {tex}{" "}
                            <span style={{ opacity: 0.7 }}>
                                {renderer instanceof (Object as any) ? "WebGL" : ""}
                            </span>
                        </div>
                        <div>
                            <strong>Maps:</strong> {maps}
                        </div>
                        <div>
                            <strong>Cache:</strong> {cacheLabel}
                        </div>
                        <div>
                            <strong>Player:</strong> {playerPos}
                        </div>
                        <div>
                            <strong>Camera:</strong> pos {camPos}
                        </div>
                        <div>
                            <strong>Angles:</strong> pitch {s.cameraPitchRS} ({camPitchDeg}°) • yaw{" "}
                            {s.cameraYawRS} ({camYawDeg}°) • roll {s.cameraRollRS} ({camRollDeg}°)
                        </div>
                    </div>
                </div>
            )}
            <div className="hud right-bottom">
                <div
                    className="content-text"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                        pointerEvents: "auto",
                    }}
                >
                    <button
                        onClick={handleSendPerf}
                        style={{
                            border: "1px solid rgba(255,255,255,0.35)",
                            borderRadius: 6,
                            background: "rgba(0,0,0,0.72)",
                            color: "#fff",
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1,
                            touchAction: "manipulation",
                        }}
                    >
                        Send Perf
                    </button>
                    <button
                        onClick={handleTogglePerfScale}
                        style={{
                            border: "1px solid rgba(255,255,255,0.35)",
                            borderRadius: 6,
                            background:
                                resolutionScaleOverride <= 0
                                    ? "rgba(0,40,22,0.82)"
                                    : resolutionScaleOverride < 1
                                      ? "rgba(87,34,0,0.82)"
                                      : "rgba(0,0,0,0.72)",
                            color: "#fff",
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1,
                            touchAction: "manipulation",
                        }}
                    >
                        {resolutionScaleOverride <= 0
                            ? `Scene Profile ${effectiveResolutionScale.toFixed(2)}x`
                            : `Scene ${resolutionScaleOverride.toFixed(1)}x`}
                    </button>
                    {sendStatus && (
                        <div
                            style={{
                                background: "rgba(0,0,0,0.55)",
                                padding: "4px 6px",
                                borderRadius: 4,
                                fontSize: 11,
                                color: "#fff",
                            }}
                        >
                            {sendStatus}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
