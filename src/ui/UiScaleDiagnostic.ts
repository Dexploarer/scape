import { computeAutoScale, getUiScale, setUiScale } from "./UiScale";
import { getCanvasCssSize, isMobileMode, isTouchDevice } from "../util/DeviceUtil";

interface UiDiagWindow {
    osrsClient?: any;
    __uiDiag?: UiScaleDiagnostic;
    __RESIZE_DEBUG__?: boolean;
}

declare const window: UiDiagWindow & Window;

function getOsrsClient(): any | undefined {
    return typeof window !== "undefined" ? window.osrsClient : undefined;
}

function getRenderer(): any | undefined {
    return getOsrsClient()?.renderer;
}

function getCanvas(): HTMLCanvasElement | undefined {
    return getRenderer()?.canvas;
}

export class UiScaleDiagnostic {
    private gridOverlayCanvas: HTMLCanvasElement | null = null;

    dump(): void {
        const client = getOsrsClient();
        const renderer = getRenderer();
        const canvas = getCanvas();
        const lines: string[] = [];
        const ln = (s: string) => lines.push(s);

        ln("=== UI Scale Diagnostic ===");

        const dpr = window.devicePixelRatio || 1;
        const scr = window.screen;
        const physW = Math.round((scr?.width ?? 0) * dpr);
        const physH = Math.round((scr?.height ?? 0) * dpr);
        const dpi = Math.round(dpr * 96);
        const vp = window.visualViewport;
        const outerW = window.outerWidth;
        const outerH = window.outerHeight;
        const colorDepth = scr?.colorDepth ?? 0;
        const orientation = scr?.orientation?.type ?? "unknown";
        ln(
            `[Screen] physical: ${physW}x${physH} | logical: ${scr?.width ?? 0}x${scr?.height ?? 0} | avail: ${scr?.availWidth ?? 0}x${scr?.availHeight ?? 0} | colorDepth: ${colorDepth} | orientation: ${orientation}\n` +
            `[DPI] devicePixelRatio: ${dpr} | effective DPI: ${dpi} | OS scaling: ${(dpr * 100).toFixed(0)}%\n` +
            `[Window] inner: ${window.innerWidth}x${window.innerHeight} | outer: ${outerW}x${outerH} | chrome: ${outerW - window.innerWidth}x${outerH - window.innerHeight}` +
            (vp ? ` | visualViewport: ${vp.width.toFixed(1)}x${vp.height.toFixed(1)} scale:${vp.scale.toFixed(2)} offset:(${vp.offsetLeft.toFixed(1)},${vp.offsetTop.toFixed(1)})` : "") +
            ` | mobile: ${isMobileMode} | touch: ${isTouchDevice}`
        );

        if (canvas) {
            const cssSize = getCanvasCssSize(canvas);
            const cssW = cssSize.width;
            const cssH = cssSize.height;
            const bufW = canvas.width;
            const bufH = canvas.height;
            ln(`[Canvas] CSS: ${cssW.toFixed(1)}x${cssH.toFixed(1)} | Buffer: ${bufW}x${bufH} | Ratio: ${(bufW / cssW).toFixed(3)}x${(bufH / cssH).toFixed(3)}`);

            const baseW = 765;
            const baseH = 503;
            const autoScale = computeAutoScale(cssW, cssH);
            const effectiveScale = getUiScale(cssW, cssH);
            ln(`[UI Scale] auto: ${autoScale} (floor(min(${(cssW / baseW).toFixed(2)}, ${(cssH / baseH).toFixed(2)}))) | effective: ${effectiveScale} | override: ${effectiveScale !== autoScale}`);

            if (effectiveScale > 1) {
                const layoutW = Math.round(bufW / effectiveScale);
                const layoutH = Math.round(bufH / effectiveScale);
                const rsX = bufW / layoutW;
                const rsY = bufH / layoutH;
                ln(`[Layout] ${layoutW}x${layoutH} (buf/${effectiveScale}) | renderScale: ${rsX.toFixed(4)}x${rsY.toFixed(4)} | widget-px-per-css-px: ${(rsX / (bufW / cssW)).toFixed(3)}x${(rsY / (bufH / cssH)).toFixed(3)}`);
            } else {
                ln(`[Layout] ${bufW}x${bufH} (1:1) | renderScale: 1x1`);
            }

            if (renderer && typeof renderer.getCanvasResolutionScale === "function") {
                ln(`[ResolutionScale] ${renderer.getCanvasResolutionScale(cssW, cssH).toFixed(3)} (CSS * this = buffer)`);
            }

            const issues: string[] = [];
            if (effectiveScale > 1) {
                const layoutW = Math.round(bufW / effectiveScale);
                const layoutH = Math.round(bufH / effectiveScale);
                const rsX = bufW / layoutW;
                const rsY = bufH / layoutH;
                if (Math.abs(rsX - Math.round(rsX)) > 0.01) issues.push(`renderScaleX ${rsX.toFixed(4)} non-integer — blurry sprites`);
                if (Math.abs(rsY - Math.round(rsY)) > 0.01) issues.push(`renderScaleY ${rsY.toFixed(4)} non-integer — blurry sprites`);
                if (rsX !== rsY) issues.push(`anisotropic: X=${rsX.toFixed(4)} Y=${rsY.toFixed(4)} — stretched widgets`);
            }
            if (autoScale >= 2 && cssW < 1600) issues.push(`auto-scale ${autoScale} on ${cssW}px viewport — layout only ${Math.round(bufW / autoScale)}px wide`);
            if (dpr > 1 && effectiveScale === 1) issues.push(`dpr ${dpr} with scale 1: buffer ${bufW}x${bufH} > CSS ${cssW.toFixed(0)}x${cssH.toFixed(0)}`);
            if (dpr > 1 && effectiveScale > 1 && Math.round(bufW / effectiveScale) < 765) issues.push(`layout width ${Math.round(bufW / effectiveScale)} < OSRS fixed 765px`);

            if (issues.length > 0) {
                ln(`[Issues] ${issues.map((s, i) => `${i + 1}. ${s}`).join(" | ")}`);
            }

            const layoutArea = effectiveScale > 1
                ? Math.round(bufW / effectiveScale) * Math.round(bufH / effectiveScale)
                : bufW * bufH;
            const rsX = effectiveScale > 1 ? bufW / Math.round(bufW / effectiveScale) : 1;
            const rsY = effectiveScale > 1 ? bufH / Math.round(bufH / effectiveScale) : 1;
            ln(`[] layout area: ${layoutArea}px² (${(layoutArea / (765 * 503)).toFixed(2)}x fixed) | 100px widget → ${(100 * rsX).toFixed(1)}x${(100 * rsY).toFixed(1)} buf px → ${(100 * rsX / (bufW / cssW)).toFixed(1)}x${(100 * rsY / (bufH / cssH)).toFixed(1)} CSS px`);
        } else {
            ln("[Canvas] Not found");
        }

        if (client?.widgetManager) {
            const wm = client.widgetManager;
            ln(`[WidgetManager] root: ${wm.rootInterface ?? "none"} | canvasW: ${(wm as any).canvasWidth ?? "?"} | canvasH: ${(wm as any).canvasHeight ?? "?"}`);
        }

        ln("=== End Diagnostic ===");
        console.log(lines.join("\n"));
    }

    setScale(scale: number | null): void {
        setUiScale(scale);
        const renderer = getRenderer();
        if (renderer && typeof renderer.forceResize === "function") {
            renderer.forceResize();
        }
        console.log(scale === null ? "UI scale reset to auto, resize applied." : `UI scale set to ${scale}, resize applied.`);
        this.dump();
    }

    testScales(): void {
        const canvas = getCanvas();
        if (!canvas) { console.log("No canvas found"); return; }
        const cssSize = getCanvasCssSize(canvas);
        const cssW = cssSize.width;
        const cssH = cssSize.height;
        const bufW = canvas.width;
        const bufH = canvas.height;
        const lines: string[] = [];
        const ln = (s: string) => lines.push(s);

        ln(`=== Scale Comparison === viewport: CSS ${cssW.toFixed(0)}x${cssH.toFixed(0)}, Buffer ${bufW}x${bufH}`);
        ln("Scale | Layout WxH      | RenderScale X/Y    | 100px widget → CSS px | Notes");
        ln("------+-----------------+--------------------+-----------------------+------");

        for (let s = 1; s <= 5; s++) {
            const layoutW = s > 1 ? Math.round(bufW / s) : bufW;
            const layoutH = s > 1 ? Math.round(bufH / s) : bufH;
            const rsX = s > 1 ? bufW / layoutW : 1;
            const rsY = s > 1 ? bufH / layoutH : 1;
            const widgetCssPx = 100 * rsX * (cssW / bufW);
            const notes: string[] = [];
            if (s === computeAutoScale(cssW, cssH)) notes.push("AUTO");
            if (s === getUiScale(cssW, cssH)) notes.push("CURRENT");
            if (layoutW < 765) notes.push("TOO NARROW");
            if (Math.abs(rsX - Math.round(rsX)) > 0.01) notes.push("NON-INT");

            ln(`  ${s}   | ${String(layoutW).padStart(5)}x${String(layoutH).padEnd(5)} | ${rsX.toFixed(4)} / ${rsY.toFixed(4)}  | ${widgetCssPx.toFixed(1).padStart(8)} CSS px       | ${notes.join(", ")}`);
        }

        ln("------+-----------------+--------------------+-----------------------+------");
        ln("Use __uiDiag.setScale(n) to switch, or __uiDiag.setScale(null) for auto.");
        console.log(lines.join("\n"));
    }

    widgets(maxDepth: number = 2): void {
        const client = getOsrsClient();
        const wm = client?.widgetManager;
        if (!wm) { console.log("No widget manager"); return; }

        const rootInterface = wm.rootInterface ?? -1;
        if (rootInterface === -1) { console.log("No root interface open"); return; }

        const roots = wm.getAllGroupRoots?.(rootInterface) ?? [];
        const lines: string[] = [];
        const ln = (s: string) => lines.push(s);

        const typeNames: Record<number, string> = { 0: "CONTAINER", 3: "RECT", 4: "TEXT", 5: "SPRITE", 6: "MODEL", 9: "LINE" };

        const canvas = getCanvas();
        const cssSize = canvas ? getCanvasCssSize(canvas) : { width: 0, height: 0 };
        const bufW = canvas?.width ?? 0;
        const effectiveScale = getUiScale(cssSize.width, cssSize.height);
        const layoutW = effectiveScale > 1 ? Math.round(bufW / effectiveScale) : bufW;
        const cssPxPerLogical = cssSize.width > 0 && layoutW > 0 ? cssSize.width / layoutW : 1;

        ln(`=== Widget Tree (root ${rootInterface}, ${roots.length} root(s)) ===`);

        const visit = (w: any, depth: number, prefix: string) => {
            if (!w || depth > maxDepth) return;
            const uid = w.uid ?? -1;
            const gid = (uid >>> 16) & 0xffff;
            const cid = uid & 0xffff;
            const typeName = typeNames[w.type ?? -1] ?? `TYPE_${w.type}`;
            const width = w.width ?? 0;
            const height = w.height ?? 0;
            const cssPxW = (width * cssPxPerLogical).toFixed(1);
            const cssPxH = (height * cssPxPerLogical).toFixed(1);
            const pct = cssSize.width > 0 ? ((width * cssPxPerLogical / cssSize.width) * 100).toFixed(1) : "?";
            const flags: string[] = [];
            if (w.hidden) flags.push("HIDDEN");
            if (w.filled) flags.push("FILLED");
            if (w.spriteId >= 0) flags.push(`spr:${w.spriteId}`);
            if (w.text) flags.push(`"${String(w.text).slice(0, 20)}"`);
            if (w.name) flags.push(`name:"${w.name}"`);

            ln(`${prefix}[${gid}:${cid}] ${typeName} pos(${w._absX ?? w.x ?? 0},${w._absY ?? w.y ?? 0}) size(${width}x${height}) → ${cssPxW}x${cssPxH}css (${pct}%W) ${flags.join(" ")}`);

            const children = [...(w.children ?? []), ...(wm.getStaticChildrenByParentUid?.(uid) ?? [])];
            for (const child of children) visit(child, depth + 1, prefix + "  ");
        };

        for (const root of roots) visit(root, 0, "");
        ln("=== End Widget Tree === (use __uiDiag.widgets(3) for deeper)");
        console.log(lines.join("\n"));
    }

    large(thresholdPct: number = 20): void {
        const client = getOsrsClient();
        const wm = client?.widgetManager;
        if (!wm) { console.log("No widget manager"); return; }

        const canvas = getCanvas();
        const cssSize = canvas ? getCanvasCssSize(canvas) : { width: 0, height: 0 };
        const bufW = canvas?.width ?? 0;
        const bufH = canvas?.height ?? 0;
        const effectiveScale = getUiScale(cssSize.width, cssSize.height);
        const layoutW = effectiveScale > 1 ? Math.round(bufW / effectiveScale) : bufW;
        const layoutH = effectiveScale > 1 ? Math.round(bufH / effectiveScale) : bufH;

        const rootInterface = wm.rootInterface ?? -1;
        if (rootInterface === -1) { console.log("No root interface open"); return; }

        const results: Array<{ uid: string; type: string; logicalW: number; logicalH: number; pctW: number; pctH: number; text?: string }> = [];
        const typeNames: Record<number, string> = { 0: "CONTAINER", 3: "RECT", 4: "TEXT", 5: "SPRITE", 6: "MODEL", 9: "LINE" };

        const roots = wm.getAllGroupRoots?.(rootInterface) ?? [];
        const visit = (w: any) => {
            if (!w || w.hidden) return;
            const width = w.width ?? 0;
            const height = w.height ?? 0;
            const pctW = layoutW > 0 ? (width / layoutW) * 100 : 0;
            const pctH = layoutH > 0 ? (height / layoutH) * 100 : 0;
            if (pctW >= thresholdPct || pctH >= thresholdPct) {
                const uid = w.uid ?? -1;
                results.push({
                    uid: `${(uid >>> 16) & 0xffff}:${uid & 0xffff}`,
                    type: typeNames[w.type ?? -1] ?? `TYPE_${w.type}`,
                    logicalW: width, logicalH: height, pctW, pctH,
                    text: w.text ? String(w.text).slice(0, 30) : undefined,
                });
            }
            for (const child of w.children ?? []) visit(child);
            for (const child of wm.getStaticChildrenByParentUid?.(w.uid) ?? []) visit(child);
        };
        for (const root of roots) visit(root);

        results.sort((a, b) => Math.max(b.pctW, b.pctH) - Math.max(a.pctW, a.pctH));

        const lines: string[] = [];
        lines.push(`=== Widgets >= ${thresholdPct}% of layout (${results.length} found) | Layout: ${layoutW}x${layoutH} ===`);
        for (const r of results) {
            lines.push(`  [${r.uid}] ${r.type} ${r.logicalW}x${r.logicalH} (${r.pctW.toFixed(1)}%W x ${r.pctH.toFixed(1)}%H)${r.text ? ` "${r.text}"` : ""}`);
        }
        console.log(lines.join("\n"));
    }

    grid(): void {
        const canvas = getCanvas();
        if (!canvas) { console.log("No canvas found"); return; }

        if (this.gridOverlayCanvas) {
            this.gridOverlayCanvas.remove();
            this.gridOverlayCanvas = null;
            console.log("Grid overlay removed.");
            return;
        }

        const overlay = document.createElement("canvas");
        overlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
        const parent = canvas.parentElement;
        if (!parent) { console.log("Canvas has no parent"); return; }
        parent.style.position = "relative";
        parent.appendChild(overlay);
        this.gridOverlayCanvas = overlay;

        const drawGrid = () => {
            if (!this.gridOverlayCanvas) return;
            const cssSize = getCanvasCssSize(canvas);
            const cssW = cssSize.width;
            const cssH = cssSize.height;
            const effectiveScale = getUiScale(cssW, cssH);
            const bufW = canvas.width;
            const bufH = canvas.height;

            overlay.width = Math.round(cssW);
            overlay.height = Math.round(cssH);
            const ctx = overlay.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const layoutW = effectiveScale > 1 ? Math.round(bufW / effectiveScale) : bufW;
            const layoutH = effectiveScale > 1 ? Math.round(bufH / effectiveScale) : bufH;
            const cssPxPerLogical = cssW / layoutW;

            ctx.strokeStyle = "rgba(255, 0, 255, 0.3)";
            ctx.lineWidth = 1;
            for (let lx = 0; lx <= layoutW; lx += 100) {
                const cx = lx * cssPxPerLogical;
                ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, overlay.height); ctx.stroke();
            }
            for (let ly = 0; ly <= layoutH; ly += 100) {
                const cy = ly * cssPxPerLogical;
                ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(overlay.width, cy); ctx.stroke();
            }

            ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(0, 0, Math.min(765, layoutW) * cssPxPerLogical, Math.min(503, layoutH) * cssPxPerLogical);
            ctx.setLineDash([]);

            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.font = "12px monospace";
            ctx.fillText(`Scale: ${effectiveScale} | Layout: ${layoutW}x${layoutH} | 1 logical = ${cssPxPerLogical.toFixed(2)} CSS px | Green = OSRS 765x503`, 4, 14);

            requestAnimationFrame(drawGrid);
        };

        drawGrid();
        console.log("Grid overlay enabled. __uiDiag.grid() again to remove.");
    }
}

const GAME_STATE_LOGGED_IN = 30;

function waitForLogin(diag: UiScaleDiagnostic): void {
    let dumped = false;
    const check = () => {
        if (dumped) return;
        const client = getOsrsClient();
        if (client && client.gameState === GAME_STATE_LOGGED_IN) {
            dumped = true;
            setTimeout(() => {
                console.log("[UiScaleDiagnostic] Login detected — auto-dumping diagnostics");
                try { diag.dump(); } catch (e) { console.log("[UiScaleDiagnostic] dump() error:", e); }
                try { diag.testScales(); } catch (e) { console.log("[UiScaleDiagnostic] testScales() error:", e); }
                try { diag.large(20); } catch (e) { console.log("[UiScaleDiagnostic] large() error:", e); }
            }, 1500);
            return;
        }
        setTimeout(check, 500);
    };
    check();
}

export function installUiDiagnostic(): void {
    if (typeof window === "undefined") return;
    const diag = new UiScaleDiagnostic();
    (window as any).__uiDiag = diag;
    console.log("[UiScaleDiagnostic] Installed: __uiDiag.dump() | .setScale(n) | .testScales() | .widgets(depth) | .large(pct) | .grid()");
    waitForLogin(diag);
}
