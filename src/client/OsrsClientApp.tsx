import { useCallback, useEffect, useMemo, useState } from "react";
import { registerSerializer } from "threads";
import WebFont from "webfontloader";

import {
    sendHandshake,
    setAutoSendHandshake,
    subscribeHandshake,
    subscribeLoginResponse,
} from "../network/ServerConnection";
import { pruneCacheStorage, resolveCacheKey } from "../rs/cache/CacheFiles";
import { IndexType } from "../rs/cache/IndexType";
import {
    getCacheManifestEntry,
    isCacheManifestComplete,
    removeCacheManifestEntry,
    writeCacheManifestEntry,
} from "../util/CacheManifest";
import { isIos, isTouchDevice } from "../util/DeviceUtil";
import {
    describeStorageShortfall,
    ensurePersistentStorage,
    getStorageBudget,
    hasEnoughStorage,
} from "../util/StorageUtil";
import { fetchCacheList, loadCacheFiles } from "./Caches";
import { GameContainer } from "./GameContainer";
import { getAvailableRenderers } from "./GameRenderers";
import { OsrsClient } from "./OsrsClient";
import { ObjSpawn, fetchObjSpawns } from "./data/obj/ObjSpawn";
import { useSafariLandscapeLock } from "./useSafariLandscapeLock";
import { useViewportCssVars } from "./useViewportCssVars";
import { renderDataLoaderSerializer } from "./worker/RenderDataLoader";
import { RenderDataWorkerPool } from "./worker/RenderDataWorkerPool";

registerSerializer(renderDataLoaderSerializer);

WebFont.load({
    custom: {
        families: ["OSRS Bold", "OSRS Small"],
    },
});

const cachesPromise = fetchCacheList();

// --- HMR-aware nonce to force worker pool re-creation on Fast Refresh ---
declare const module: any;

type LoginUnsubscriber = () => void;
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function readWorkerPoolNonce(): number {
    if (typeof window === "undefined") return 0;
    const value = window.__rsWorkerPoolNonce;
    return typeof value === "number" && Number.isFinite(value) ? value | 0 : 0;
}

function incrementWorkerPoolNonce(): void {
    if (typeof window === "undefined") return;
    const current = readWorkerPoolNonce();
    window.__rsWorkerPoolNonce = (current + 1) | 0;
}

function isStandaloneDisplayMode(): boolean {
    if (typeof window === "undefined") return false;
    const nav = window.navigator as NavigatorWithStandalone;
    const isStandaloneMedia =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches;
    return isStandaloneMedia || nav.standalone === true;
}

function hasCacheStorage(): boolean {
    return typeof globalThis.caches !== "undefined";
}

// Initialize and capture a stable nonce for this module evaluation
if (typeof window !== "undefined" && window.__rsWorkerPoolNonce === undefined) {
    window.__rsWorkerPoolNonce = 0;
}
const workerPoolNonce = readWorkerPoolNonce();

// On hot-reload, dispose the existing OsrsClient and increment the nonce
if (typeof module !== "undefined" && module.hot) {
    module.hot.dispose(() => {
        if (typeof window !== "undefined") {
            // Dispose existing OsrsClient to stop audio and free resources
            const existingClient = window.osrsClient;
            if (existingClient) {
                existingClient.dispose();
                window.osrsClient = undefined;
            }
            // Increment nonce so useMemo re-creates the worker pool
            incrementWorkerPoolNonce();
        }
    });
}

// Worker pool is created inside the component so we can tune thread count

function OsrsClientApp() {
    const [errorMessage, setErrorMessage] = useState<string>();
    const [osrsClient, setOsrsClient] = useState<OsrsClient>();
    const [storageWarnings, setStorageWarnings] = useState<string[]>([]);
    const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent>();
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showIosInstallHint, setShowIosInstallHint] = useState(false);
    const loginUnsubscribers = useMemo<Array<LoginUnsubscriber>>(() => [], []);
    useViewportCssVars();
    const shouldEnableSafariLandscapeLock = osrsClient?.isLoggedIn() ?? false;
    const safariLandscapeLock = useSafariLandscapeLock(shouldEnableSafariLandscapeLock);

    const addStorageWarning = useCallback((message: string) => {
        setStorageWarnings((prev) => {
            if (prev.includes(message)) {
                return prev;
            }
            return [...prev, message];
        });
    }, []);

    useEffect(() => {
        if (!(isTouchDevice || isIos)) return;

        const isStandalone = isStandaloneDisplayMode();

        if (isIos && !isStandalone) {
            setShowIosInstallHint(true);
        }

        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            if (!isTouchDevice) return;
            const promptEvent = event as BeforeInstallPromptEvent;
            setDeferredInstallPrompt(promptEvent);
            setShowInstallPrompt(true);
        };

        const handleAppInstalled = () => {
            setDeferredInstallPrompt(undefined);
            setShowInstallPrompt(false);
            setShowIosInstallHint(false);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const handleInstallClick = useCallback(async () => {
        const promptEvent = deferredInstallPrompt;
        if (!promptEvent) return;
        try {
            promptEvent.prompt();
            await promptEvent.userChoice.catch(() => {});
        } finally {
            setDeferredInstallPrompt(undefined);
            setShowInstallPrompt(false);
        }
    }, [deferredInstallPrompt]);

    const dismissInstallPrompt = useCallback(() => {
        setShowInstallPrompt(false);
    }, []);

    const dismissIosHint = useCallback(() => {
        setShowIosInstallHint(false);
    }, []);

    // Determine worker threads: default to 1 to reduce memory.
    const workerCount = useMemo(() => {
        return 1;
    }, []);

    const workerPool = useMemo(
        () => RenderDataWorkerPool.create(workerCount),
        [workerCount, workerPoolNonce],
    );

    useEffect(() => {
        return () => {
            // Terminate workers on unmount or when workerCount changes
            workerPool.terminate().catch(() => {});
        };
    }, [workerPool]);

    useEffect(() => {
        const abortController = new AbortController();

        const load = async () => {
            const objSpawnsPromise = fetchObjSpawns();

            const cacheList = await cachesPromise;
            if (!cacheList) {
                setErrorMessage("Failed to load cache list");
                throw new Error("No caches found");
            }

            // No URL params supported: always use latest cache
            let cacheInfo = cacheList.latest;

            const isStandalone = isStandaloneDisplayMode();

            const persisted = await ensurePersistentStorage();

            // On iOS PWA, storage is automatically persistent even if the API says otherwise
            const effectivelyPersistent = persisted === true || (isStandalone && isIos);

            if (!effectivelyPersistent) {
                if (persisted === false) {
                    console.warn(
                        "[storage] Browser denied persistent storage; cached RuneScape data may be evicted",
                    );
                    // Notification removed - user is likely on iOS PWA where storage is persistent anyway
                } else if (persisted === "unsupported") {
                    console.warn(
                        "[storage] Persistent storage API not available; browser may evict cached data",
                    );
                    addStorageWarning(
                        "Persistent storage not supported in this browser. Cached assets may be cleared. Install as PWA or use a modern browser.",
                    );
                }

                if (isIos && !isStandalone) {
                    addStorageWarning(
                        "On iOS Safari, tap Share → Add to Home Screen to keep the cache between launches.",
                    );
                }
            }

            const cacheSize = typeof cacheInfo.size === "number" ? cacheInfo.size : 0;
            const expectedBytes = Math.max(cacheSize, 256 * 1024 * 1024);
            const budget = await getStorageBudget();
            const enoughStorage = await hasEnoughStorage(expectedBytes);
            if (!enoughStorage) {
                setErrorMessage(
                    `Not enough storage available to keep the RuneScape cache. ${describeStorageShortfall(
                        expectedBytes,
                        budget,
                    )}`,
                );
                return;
            }

            await pruneCacheStorage([cacheInfo.name, "map-images"]);

            const manifestEntry = await getCacheManifestEntry(cacheInfo.name);
            let cacheInvalidated = false;
            if (manifestEntry) {
                const complete = await isCacheManifestComplete(manifestEntry);
                if (!complete) {
                    cacheInvalidated = true;
                    await removeCacheManifestEntry(cacheInfo.name);
                    addStorageWarning(
                        "Cached RuneScape data was cleared by the browser; assets will be re-downloaded.",
                    );
                }
            }

            if (cacheInvalidated && hasCacheStorage()) {
                try {
                    await globalThis.caches.delete(resolveCacheKey(cacheInfo.name));
                } catch {}
            }

            // ========== Create OsrsClient BEFORE cache download ==========
            // This allows the LoginRenderer to display download progress via the state machine
            const availableRenderers = getAvailableRenderers();
            if (availableRenderers.length === 0) {
                setErrorMessage("No renderers available");
                return;
            }
            const rendererType = availableRenderers[0];

            // Open map image cache early
            let mapImageCache: Cache;
            try {
                if (hasCacheStorage()) {
                    mapImageCache = await globalThis.caches.open(resolveCacheKey("map-images"));
                } else {
                    mapImageCache = { put: async () => {} } as unknown as Cache;
                }
            } catch {
                mapImageCache = { put: async () => {} } as unknown as Cache;
            }

            // Await objSpawns early
            const objSpawns: ObjSpawn[] = await objSpawnsPromise;

            // Create OsrsClient without cache - starts in DOWNLOADING state
            const client = new OsrsClient(
                workerPool,
                cacheList,
                objSpawns,
                mapImageCache,
                rendererType,
                // No cache yet - will be initialized after download
            );

            // Set OsrsClient immediately so GameContainer can render the login overlay
            setOsrsClient(client);
            window.osrsClient = client;

            // ========== Download cache with progress routed through OsrsClient ==========
            // Load all cache files during DOWNLOADING phase
            // Extra indices needed for full functionality
            const extraIndexIds = [
                IndexType.DAT2.interfaces,
                IndexType.DAT2.fonts,
                IndexType.DAT2.clientScript,
                IndexType.DAT2.musicTracks,
                IndexType.DAT2.musicSamples,
                IndexType.DAT2.musicPatches,
            ];

            const cache = await loadCacheFiles(
                cacheInfo,
                abortController.signal,
                (progress) => {
                    // Route download progress through OsrsClient to LoginState
                    client.setDownloadProgress(progress.current, progress.total, progress.label);
                },
                extraIndexIds,
                false, // Load all indices upfront for worker compatibility
            );

            // ========== Ensure renderer is ready before loading ==========
            // Wait for React to render GameContainer/Canvas and for renderer to initialize
            // This is needed because if cache is already cached, loadCacheFiles returns instantly
            // and we'd call initCache before the render loop is running
            await new Promise<void>((resolve) => {
                const checkRenderer = () => {
                    if (client.renderer?.running) {
                        resolve();
                    } else {
                        requestAnimationFrame(checkRenderer);
                    }
                };
                // Give React time to render (state updates are async)
                setTimeout(checkRenderer, 100);
            });

            // ========== Initialize cache and finalize OsrsClient ==========
            client.initCache(cache);
            client.init();

            // ========== Login Screen Flow ==========
            setAutoSendHandshake(false);

            const unsubLogin = subscribeLoginResponse((response) => {
                if (response.success) {
                    console.log("[OsrsClientApp] Login successful, sending handshake");
                    const username =
                        client.loginState?.username || response.displayName || "Player";
                    sendHandshake(username);
                } else {
                    console.log(
                        "[OsrsClientApp] Login failed:",
                        response.errorCode,
                        response.error,
                    );
                    if (response.errorCode !== undefined) {
                        client.handleLoginError(response.errorCode);
                    } else {
                        client.onLoginFailed(response.error || "Login failed");
                    }
                }
            });

            const unsubHandshake = subscribeHandshake((info) => {
                console.log("[OsrsClientApp] Handshake received, player logged in:", info.name);
                client.onLoginSuccess();
            });
            loginUnsubscribers.push(unsubLogin, unsubHandshake);

            try {
                const fileNames = cache.files.getFileNames();
                await writeCacheManifestEntry({
                    cacheName: cacheInfo.name,
                    files: fileNames,
                    updatedAt: new Date().toISOString(),
                    size: cacheInfo.size,
                    revision: cacheInfo.revision,
                });
            } catch {}
        };

        // Attempt to load regardless of platform; rely on feature detection
        // to determine available renderers at runtime.
        load().catch((err) => {
            console.error(err);
            try {
                const msg = err && typeof err.message === "string" ? err.message : String(err);
                setErrorMessage(msg || "Failed to initialize");
            } catch {
                setErrorMessage("Failed to initialize");
            }
        });

        return () => {
            while (loginUnsubscribers.length > 0) {
                const unsub = loginUnsubscribers.pop();
                if (!unsub) continue;
                try {
                    unsub();
                } catch {}
            }
            abortController.abort();
        };
    }, [addStorageWarning, loginUnsubscribers]);

    let content: JSX.Element | undefined;

    if (errorMessage) {
        content = <div className="center-container max-height content-text">{errorMessage}</div>;
    } else if (osrsClient) {
        // Show GameContainer - LoginRenderer handles all loading states (DOWNLOADING and LOADING)
        content = <GameContainer osrsClient={osrsClient} />;
    } else {
        // Brief loading state before OsrsClient is created (checking storage, opening caches, etc.)
        content = (
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "black",
                }}
            />
        );
    }

    let bannerContent: JSX.Element | undefined;
    if (showInstallPrompt) {
        bannerContent = (
            <div
                style={{
                    background: "#0f0d25",
                    color: "#ffffff",
                    padding: "20px 24px",
                    fontSize: "0.95rem",
                    lineHeight: 1.4,
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Install OSRS Client</div>
                <div style={{ marginBottom: 14 }}>
                    Add the app for faster launches and offline-ready assets.
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        type="button"
                        onClick={handleInstallClick}
                        style={{
                            flex: 1,
                            background: "#4a43ff",
                            color: "#ffffff",
                            border: "none",
                            padding: "12px 18px",
                            borderRadius: 10,
                            fontWeight: 600,
                        }}
                    >
                        Install
                    </button>
                    <button
                        type="button"
                        onClick={dismissInstallPrompt}
                        style={{
                            flex: "0 0 auto",
                            background: "rgba(255,255,255,0.1)",
                            color: "#f8f9ff",
                            border: "none",
                            padding: "12px 18px",
                            borderRadius: 10,
                        }}
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        );
    } else if (storageWarnings.length > 0) {
        bannerContent = (
            <div
                style={{
                    background: "#150f2e",
                    color: "#f2f2ff",
                    padding: "18px 24px",
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                }}
            >
                {storageWarnings.map((msg, idx) => (
                    <p key={idx} style={{ margin: idx === 0 ? 0 : "8px 0 0" }}>
                        {msg}
                    </p>
                ))}
            </div>
        );
    } else if (showIosInstallHint) {
        bannerContent = (
            <div
                style={{
                    background: "#0f0d25",
                    color: "#f8f9ff",
                    padding: "18px 24px",
                    fontSize: "0.95rem",
                    lineHeight: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <span>
                    Add OSRS Client to your home screen: tap the share icon, then choose
                    <strong> Add to Home Screen</strong>.
                </span>
                <button
                    type="button"
                    onClick={dismissIosHint}
                    style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#f8f9ff",
                        borderRadius: 10,
                        padding: "8px 14px",
                        fontSize: "0.8rem",
                    }}
                >
                    Got it
                </button>
            </div>
        );
    }

    const bannerWrapper = bannerContent ? (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                pointerEvents: "auto",
                boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            }}
        >
            {bannerContent}
        </div>
    ) : null;

    const appClassName = [
        "App",
        "max-height",
        safariLandscapeLock.enabled ? "ios-safari-force-landscape" : "",
        safariLandscapeLock.enabled && safariLandscapeLock.rotated
            ? "ios-safari-force-landscape-rotated"
            : "",
    ]
        .filter((name) => name.length > 0)
        .join(" ");

    return (
        <div className={appClassName}>
            {bannerWrapper}
            {content}
        </div>
    );
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => void;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default OsrsClientApp;
