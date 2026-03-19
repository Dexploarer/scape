import { useCallback, useEffect, useRef, useState } from "react";

import { RenderStatsOverlay } from "../components/renderer/RenderStatsOverlay";
import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
// Legacy CSS menu and React minimap/orbs removed in favor of widget-based rendering
import { WorldMapModal } from "../components/rs/worldmap/WorldMapModal";
import {
    isServerConnected,
    sendTeleport,
    subscribeChatMessages,
} from "../network/ServerConnection";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { Canvas } from "../ui/Canvas";
import { formatBytes } from "../util/BytesUtil";
import { isMobileMode } from "../util/DeviceUtil";
import { DebugControls } from "./DebugControls";
import "./GameContainer.css";
import { GameRenderer } from "./GameRenderer";
import { OsrsClient } from "./OsrsClient";
import { SidebarShell } from "./sidebar/SidebarShell";

interface OsrsContainerProps {
    osrsClient: OsrsClient;
}

type WidgetActionBridgeEvent = {
    widget?: unknown;
    option?: string;
    target?: string;
    cursorX?: number;
    cursorY?: number;
    slot?: number;
    itemId?: number;
};

type WidgetMenuProvider = {
    getEntriesAt?: (x: number, y: number) => unknown[] | undefined;
};

type WidgetLookupInput = {
    groupId?: number;
};

type CanvasUiBridgeState = {
    mouseX?: number;
    mouseY?: number;
    onWidgetAction?: (event: WidgetActionBridgeEvent) => void;
    getWidgetMenuEntries?: (
        widget: WidgetLookupInput | undefined,
        px?: number,
        py?: number,
    ) => unknown[];
    inventoryMenu?: WidgetMenuProvider;
    spellbookMenu?: WidgetMenuProvider;
};

type CanvasWithUiBridge = HTMLCanvasElement & {
    __ui?: CanvasUiBridgeState;
};

function resolvePointerCoordinate(
    explicitValue: number | undefined,
    fallbackValue: number | undefined,
): number {
    if (typeof explicitValue === "number" && !Number.isNaN(explicitValue)) {
        return explicitValue;
    }
    if (typeof fallbackValue === "number" && !Number.isNaN(fallbackValue)) {
        return fallbackValue;
    }
    return -1;
}

export function GameContainer({ osrsClient }: OsrsContainerProps): JSX.Element {
    const [renderer, setRenderer] = useState<GameRenderer>(osrsClient.renderer);

    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();

    const [hideUi, setHideUi] = useState(false);
    const [fps, setFps] = useState(0);
    const [, forceStatsOverlayRefresh] = useState(0);
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);
    const [fishingStatus, setFishingStatus] = useState<{ label: string; detail: string } | null>(
        null,
    );
    const fishingStatusTimer = useRef<number | undefined>();
    const allowWorldMapTeleport = true;

    // Legacy CSS menu props removed

    const requestRef = useRef<number | undefined>();
    const widgetManagerReady = osrsClient.widgetManager != null;

    const animate = (time: DOMHighResTimeStamp) => {
        setFps(Math.round(renderer.stats.frameTimeFps));
        if (!hideUi && osrsClient.hoverOverlayEnabled) {
            // Keep F3 stats overlay values live even when FPS number doesn't change.
            forceStatsOverlayRefresh(renderer.stats.frameCount | 0);
        }

        // WebGL overlay handles Choose Option; no CSS menu props updates needed

        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        renderer.setUiHidden(hideUi);
    }, [renderer, hideUi]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [hideUi, renderer, osrsClient]);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            if (!widgetManagerReady || !renderer.canvas.isConnected) {
                return;
            }
            renderer.forceResize();
            osrsClient.updateWidgets();
        });
        return () => cancelAnimationFrame(frameId);
    }, [renderer, osrsClient, widgetManagerReady]);

    // Optional: hook to handle widget context-menu actions dispatched from the GL UI
    useEffect(() => {
        try {
            const canvas = renderer?.canvas as CanvasWithUiBridge | undefined;
            if (!canvas) return;
            const uiState: CanvasUiBridgeState = canvas.__ui || {};
            canvas.__ui = uiState;
            uiState.onWidgetAction = (event: WidgetActionBridgeEvent) => {
                const cursorX = resolvePointerCoordinate(event.cursorX, uiState.mouseX);
                const cursorY = resolvePointerCoordinate(event.cursorY, uiState.mouseY);
                osrsClient.handleWidgetAction({
                    ...event,
                    cursorX,
                    cursorY,
                });
            };
            // Provide dynamic widget menu entries for special UIs (e.g., mobile viewport icons)
            uiState.getWidgetMenuEntries = (
                widget: WidgetLookupInput | undefined,
                px?: number,
                py?: number,
            ) => {
                try {
                    if (!widget) return [];
                    if (typeof widget.groupId !== "number") return [];
                    const groupId = widget.groupId | 0;
                    const pointerX = resolvePointerCoordinate(px, uiState.mouseX);
                    const pointerY = resolvePointerCoordinate(py, uiState.mouseY);

                    if (groupId === 149 && pointerX >= 0 && pointerY >= 0) {
                        const menu = uiState.inventoryMenu;
                        const slotEntries =
                            typeof menu?.getEntriesAt === "function"
                                ? menu.getEntriesAt(pointerX, pointerY)
                                : undefined;
                        if (slotEntries && slotEntries.length) {
                            return slotEntries;
                        }
                    }

                    if (groupId === 218 && pointerX >= 0 && pointerY >= 0) {
                        const menu = uiState.spellbookMenu;
                        const spellEntries =
                            typeof menu?.getEntriesAt === "function"
                                ? menu.getEntriesAt(pointerX, pointerY)
                                : undefined;
                        if (spellEntries && spellEntries.length) {
                            return spellEntries;
                        }
                    }
                } catch {}
                return [];
            };
        } catch {}
    }, [renderer, osrsClient]);

    const openWorldMap = useCallback(() => {
        setWorldMapOpen(true);
    }, []);

    // Wire up world map callback to OsrsClient so widget actions can trigger it
    useEffect(() => {
        osrsClient.onOpenWorldMap = openWorldMap;
        return () => {
            osrsClient.onOpenWorldMap = undefined;
        };
    }, [osrsClient, openWorldMap]);

    const closeWorldMap = useCallback(() => {
        setWorldMapOpen(false);
        renderer.canvas.focus();
    }, [renderer]);

    const onMapClicked = useCallback(
        (x: number, y: number) => {
            const tx = Math.floor(x);
            const ty = Math.floor(y);
            console.log(
                `[WorldMap] Clicked world coords x=${x.toFixed(2)}, y=${y.toFixed(
                    2,
                )} -> tile x=${tx}, y=${ty}`,
            );
            if (!allowWorldMapTeleport) {
                console.info(
                    "[WorldMap] Teleport disabled in this build; ignoring click and closing map.",
                );
                closeWorldMap();
                return;
            }

            if (isServerConnected()) {
                try {
                    const idx = osrsClient.playerEcs.getIndexForServerId(
                        osrsClient.controlledPlayerServerId,
                    );
                    const level = idx !== undefined ? osrsClient.playerEcs.getLevel(idx) : 0;
                    console.log(`[WorldMap] Sending teleport to server: (${tx}, ${ty}, ${level})`);
                    sendTeleport({ x: tx, y: ty }, level);
                } catch (err) {
                    console.error("[WorldMap] Error sending teleport to server:", err);
                }
            } else {
                console.log("[WorldMap] Server not connected, skipping server teleport");
            }

            closeWorldMap();
        },
        [osrsClient, closeWorldMap],
    );

    // Camera-based position (tiles). Used for world map and other UI.
    const getMapPosition = useCallback(() => {
        const x = osrsClient.camera.getPosX();
        const y = osrsClient.camera.getPosZ();
        return { x, y };
    }, [osrsClient]);

    const loadMapImageUrl = useCallback(
        (mapX: number, mapY: number) => {
            return osrsClient.getMapImageUrl(mapX, mapY, false);
        },
        [osrsClient],
    );

    const updateFishingStatus = useCallback((detail?: string) => {
        if (fishingStatusTimer.current) {
            window.clearTimeout(fishingStatusTimer.current);
            fishingStatusTimer.current = undefined;
        }
        if (!detail) {
            setFishingStatus(null);
            return;
        }
        setFishingStatus({ label: "Fishing", detail });
        fishingStatusTimer.current = window.setTimeout(() => {
            setFishingStatus(null);
            fishingStatusTimer.current = undefined;
        }, 4000);
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeChatMessages((msg) => {
            if (!msg || msg.messageType !== "game" || typeof msg.text !== "string") {
                return;
            }
            const normalized = msg.text.trim().toLowerCase();
            const startTriggers = [
                "attempt to catch",
                "catch some",
                "fail to catch anything",
                "haul in",
            ];
            const stopTriggers = [
                "stop fishing",
                "run out of bait",
                "run out of feathers",
                "run out of karambwanji",
                "too full to hold any more fish",
                "you don't have any",
            ];
            if (startTriggers.some((phrase) => normalized.includes(phrase))) {
                updateFishingStatus(msg.text);
                return;
            }
            if (normalized.includes("minnow") && normalized.includes("catch")) {
                updateFishingStatus(msg.text);
                return;
            }
            if (stopTriggers.some((phrase) => normalized.includes(phrase))) {
                updateFishingStatus(undefined);
            }
        });
        return () => {
            unsubscribe();
            if (fishingStatusTimer.current) {
                window.clearTimeout(fishingStatusTimer.current);
                fishingStatusTimer.current = undefined;
            }
        };
    }, [updateFishingStatus]);

    let loadingBarOverlay: JSX.Element | undefined = undefined;
    if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        loadingBarOverlay = (
            <div className="overlay-container max-height">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    }

    return (
        <div className="max-height game-container-root">
            <div className={isMobileMode ? "game-viewport game-viewport-mobile" : "game-viewport"}>
                <div className="game-canvas-shell">
                    <div className="game-canvas-stage">
                        {loadingBarOverlay}

                        <div className="hud right-top">
                            <div className="fps-counter content-text">{fps}</div>
                            {!hideUi && (
                                <>
                                    <div className="fps-counter content-text">
                                        {osrsClient.debugText}
                                    </div>
                                    {fishingStatus && (
                                        <div className="skill-status content-text">
                                            <div className="label">Fishing</div>
                                            <div className="detail">{fishingStatus.detail}</div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* CSS-based OSRS menu removed in favor of GL overlay */}

                        {!hideUi && osrsClient.customLabelScreens.length > 0 && (
                            <>
                                {osrsClient.customLabelScreens.map((lbl, i) => (
                                    <div
                                        key={`custom-label-${i}`}
                                        className="tile-label content-text"
                                        style={{
                                            position: "absolute",
                                            left: lbl.x,
                                            top: lbl.y - 16,
                                            pointerEvents: "none",
                                        }}
                                    >
                                        {lbl.text}
                                    </div>
                                ))}
                            </>
                        )}

                        <Canvas renderer={renderer} />
                    </div>
                </div>

                {!hideUi && (
                    <span>
                        <WorldMapModal
                            isOpen={isWorldMapOpen}
                            onRequestClose={closeWorldMap}
                            onDoubleClick={onMapClicked}
                            getPosition={getMapPosition}
                            loadMapImageUrl={loadMapImageUrl}
                        />
                        {/* Bottom-left performance/optimization overlay (F3 toggles) */}
                        {(osrsClient.hoverOverlayEnabled || isMobileMode) && (
                            <>
                                <RenderStatsOverlay
                                    renderer={renderer}
                                    cacheInfo={osrsClient.loadedCache?.info}
                                    showDetails={osrsClient.hoverOverlayEnabled}
                                />
                            </>
                        )}
                        {/* OSRS tabs moved into WebGL devoverlay */}
                    </span>
                )}

                {!hideUi && !osrsClient.isOnLoginScreen() && (
                    <SidebarShell osrsClient={osrsClient} store={osrsClient.sidebar} />
                )}
            </div>

            {/* Debug controls sidebar (Leva) - top-left corner */}
            <DebugControls
                renderer={renderer}
                hideUi={hideUi}
                setRenderer={setRenderer}
                setHideUi={setHideUi}
                setDownloadProgress={setDownloadProgress}
            />
        </div>
    );
}
