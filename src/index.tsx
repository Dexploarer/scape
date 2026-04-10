import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import OsrsClientApp from "./client/OsrsClientApp";
import "./index.css";
import { disposeServerConnection, initServerConnection } from "./network/ServerConnection";
import reportWebVitals from "./reportWebVitals";
import { Bzip2 } from "./rs/compression/Bzip2";
import { Gzip } from "./rs/compression/Gzip";
import { registerServiceWorker } from "./serviceWorkerRegistration";
import { installUiDiagnostic } from "./ui/UiScaleDiagnostic";

declare const module: any; // HMR typing

Bzip2.initWasm();
Gzip.initWasm();

// Opt-in URL flag to enable verbose resize debugging
try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("debugResize")) {
        (window as any).__RESIZE_DEBUG__ = true;
        // eslint-disable-next-line no-console
        console.log("[resize] debug enabled via ?debugResize");
    }
} catch {}

// Hard-reset escape hatch: visit `?reset=1` to nuke every scrap of
// client-side state (localStorage, sessionStorage, IndexedDB, the
// CacheStorage the service worker uses, and any registered service
// workers) and reload. Exists so operators who have a deployed build
// stuck on a stale server URL / cached bundle can recover with one
// click instead of chasing down DevTools menus.
//
// After the wipe we strip the flag from the URL so a refresh doesn't
// re-wipe endlessly, and we reload without the query string. The
// whole thing is wrapped in a try/catch so a broken browser
// storage API doesn't kill the app boot.
try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("reset")) {
        // Block the rest of module load — we're about to blow away
        // every piece of client state and reload, so there's no point
        // initializing the React tree.
        // eslint-disable-next-line no-console
        console.warn("[reset] wiping client state...");
        (async () => {
            try { localStorage.clear(); } catch {}
            try { sessionStorage.clear(); } catch {}
            try {
                if (typeof caches !== "undefined") {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                }
            } catch {}
            try {
                if (navigator.serviceWorker) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                }
            } catch {}
            try {
                if (typeof indexedDB !== "undefined" && indexedDB.databases) {
                    const dbs = await indexedDB.databases();
                    await Promise.all(
                        dbs.map(
                            (db) =>
                                new Promise<void>((resolve) => {
                                    if (!db.name) return resolve();
                                    const req = indexedDB.deleteDatabase(db.name);
                                    req.onsuccess = req.onerror = req.onblocked = () =>
                                        resolve();
                                }),
                        ),
                    );
                }
            } catch {}
            try {
                const clean = new URL(window.location.href);
                clean.searchParams.delete("reset");
                window.location.replace(clean.toString());
            } catch {
                window.location.reload();
            }
        })();
        // Throw so React's root.render below doesn't paint the old
        // app on top of the wipe. The thrown error lands in the
        // module's top-level try/catch (the one we're already in),
        // which is a harmless no-op since the reload is already
        // scheduled above.
        throw new Error("[reset] wipe in progress — reloading");
    }
} catch (err) {
    if (err instanceof Error && err.message.startsWith("[reset]")) {
        // Re-throw to halt module evaluation — we ARE resetting.
        throw err;
    }
    // Any other error is a broken browser API or missing feature;
    // swallow it so the app still boots.
}

// UI scale diagnostic kit — available via __uiDiag in browser console
// Auto-dumps diagnostics on login. Also callable manually anytime.
installUiDiagnostic();

// NOTE: Server connection is initialized in OsrsClientApp after widget manager is ready

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
    // <React.StrictMode>
    <BrowserRouter>
        <OsrsClientApp />
    </BrowserRouter>,
    // </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

registerServiceWorker();

// During Fast Refresh/HMR, close app-level sockets before applying updates
try {
    if (typeof module !== "undefined" && module?.hot) {
        // React Fast Refresh lifecycle: prepare -> apply -> idle
        module.hot.addStatusHandler((status: string) => {
            if (status === "prepare") {
                try {
                    disposeServerConnection("hmr prepare");
                } catch {}
            } else if (status === "idle") {
                try {
                    initServerConnection();
                } catch {}
            }
        });
    }
} catch {}
