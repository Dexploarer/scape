import React from "react";

import type { GameRenderer } from "../../client/GameRenderer";
import { RS_TO_DEGREES } from "../../rs/MathConstants";
import type { CacheInfo } from "../../rs/cache/CacheInfo";
import { checkIos, checkMobile } from "../../util/DeviceUtil";
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

export function RenderStatsOverlay({
    renderer,
    cacheInfo,
    showDetails = true,
}: RenderStatsOverlayProps): JSX.Element {
    const s: RenderStats = renderer.stats;
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
        </>
    );
}
