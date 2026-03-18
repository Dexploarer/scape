import { getCanvasCssSize } from "../../util/DeviceUtil";
import { RenderStats } from "./RenderStats";

function isResizeDebug(): boolean {
    try {
        return window.__RESIZE_DEBUG__ === true;
    } catch {
        return false;
    }
}

function resizeCanvas(renderer: Renderer) {
    const canvas = renderer.canvas;
    const { width: cssW, height: cssH } = getCanvasCssSize(canvas);
    const resolutionScale = renderer.getCanvasResolutionScale(cssW, cssH);
    const safeResolutionScale =
        Number.isFinite(resolutionScale) && resolutionScale > 0 ? resolutionScale : 1;
    const width = Math.max(1, Math.round(cssW * safeResolutionScale));
    const height = Math.max(1, Math.round(cssH * safeResolutionScale));

    const changed = canvas.width !== width || canvas.height !== height;
    if (changed && isResizeDebug()) {
        // eslint-disable-next-line no-console
        console.log(
            `[resize] measure -> css=${Math.round(cssW)}x${Math.round(cssH)} ` +
                `canvas=${width}x${height} prev=${canvas.width}x${canvas.height}`,
        );
    }

    if (changed) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }

    return false;
}

export abstract class Renderer {
    canvas: HTMLCanvasElement;
    animationId: number | undefined;
    running: boolean = false;

    fpsLimit: number = 120;

    stats: RenderStats = new RenderStats();

    private _resizeObs?: ResizeObserver;
    private _timeoutId?: ReturnType<typeof setTimeout>;
    private _useTimeout: boolean = false;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.tabIndex = 0;
    }

    abstract init(): Promise<void>;

    abstract cleanUp(): void;

    start() {
        this.running = true;
        this._updateVisibilityMode();
        this._scheduleNextFrame();
        if (this.runInBackground) {
            document.addEventListener("visibilitychange", this._onVisibilityChange);
        }
    }

    stop() {
        this.running = false;
        document.removeEventListener("visibilitychange", this._onVisibilityChange);
        if (this.animationId !== undefined) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
        if (this._timeoutId !== undefined) {
            clearTimeout(this._timeoutId);
            this._timeoutId = undefined;
        }
        this.cleanUp();
        // Disconnect observer if attached
        try {
            this._resizeObs?.disconnect();
            this._resizeObs = undefined;
        } catch {}
    }

    private _onVisibilityChange = () => {
        if (!this.running || !this.runInBackground) return;
        const wasTimeout = this._useTimeout;
        this._updateVisibilityMode();
        // If switching from timeout to RAF, cancel timeout and start RAF
        if (wasTimeout && !this._useTimeout) {
            if (this._timeoutId !== undefined) {
                clearTimeout(this._timeoutId);
                this._timeoutId = undefined;
            }
            this._scheduleNextFrame();
        }
        // If switching from RAF to timeout, cancel RAF and start timeout
        else if (!wasTimeout && this._useTimeout) {
            if (this.animationId !== undefined) {
                cancelAnimationFrame(this.animationId);
                this.animationId = undefined;
            }
            this._scheduleNextFrame();
        }
    };

    private _updateVisibilityMode() {
        this._useTimeout = this.runInBackground && document.hidden;
    }

    protected getEffectiveFpsLimit(): number {
        const raw = Number(this.fpsLimit);
        if (!Number.isFinite(raw)) return 0;
        const limit = raw | 0;
        return limit > 0 ? limit : 0;
    }

    private _scheduleNextFrame() {
        if (!this.running) return;
        const fpsLimit = this.getEffectiveFpsLimit();
        if (this._useTimeout) {
            // Use setTimeout when tab is hidden to bypass RAF throttling
            const targetMs = fpsLimit > 0 ? 1000 / fpsLimit : 16;
            this._timeoutId = setTimeout(() => {
                this._timeoutId = undefined;
                this.frameCallback(performance.now());
            }, targetMs);
        } else {
            this.animationId = requestAnimationFrame(this.frameCallback);
        }
    }

    onResize(width: number, height: number) {}

    /**
     * Return the internal backing-store scale for the canvas.
     * Default is CSS pixel parity; renderers can override for HiDPI paths.
     */
    getCanvasResolutionScale(_cssWidth: number, _cssHeight: number): number {
        return 1;
    }

    // Public hook for hosts/observers to force size check immediately (no RAF delay)
    forceResize = () => {
        const resized = resizeCanvas(this);
        if (isResizeDebug()) {
            // eslint-disable-next-line no-console
            console.log(
                `[resize] forceResize running=${this.running} -> ${this.canvas.width}x${this.canvas.height}`,
            );
        }
        // Always call onResize if dimensions changed, even before running
        // This ensures WebGL resources are sized correctly during init
        if (resized) {
            this.onResize(this.canvas.width, this.canvas.height);
        }
    };

    frameCallback = (time: DOMHighResTimeStamp) => {
        try {
            if (this.shouldSkipFrame(time)) {
                return;
            }

            const resized = resizeCanvas(this);
            if (resized) {
                if (isResizeDebug()) {
                    // eslint-disable-next-line no-console
                    console.log(`[resize] raf -> ${this.canvas.width}x${this.canvas.height}`);
                }
                this.onResize(this.canvas.width, this.canvas.height);
            }

            const deltaTime = this.stats.getDeltaTime(time);
            const fpsLimit = this.getEffectiveFpsLimit();

            // Skip FPS limiting when using setTimeout (already throttled)
            if (!this._useTimeout && fpsLimit > 0 && deltaTime > 0) {
                const tolerance = 1;
                if (deltaTime < 1000 / fpsLimit - tolerance) {
                    return;
                }
            }

            this.stats.update(time);

            this.render(time, deltaTime, resized);

            this.onFrameEnd();
        } finally {
            if (this.running) {
                this._scheduleNextFrame();
            }
        }
    };

    abstract render(
        time: DOMHighResTimeStamp,
        deltaTime: DOMHighResTimeStamp,
        resized: boolean,
    ): void;

    onFrameEnd() {
        this.stats.onFrameEnd();
    }

    /**
     * Force an immediate render, bypassing FPS limiter.
     * Used for loading screen progress updates.
     */
    forceImmediateRender(): void {
        if (!this.running) return;
        const time = performance.now();
        const resized = resizeCanvas(this);
        if (resized) {
            this.onResize(this.canvas.width, this.canvas.height);
        }
        // Bypass FPS limiter - render immediately
        const deltaTime = this.stats.getDeltaTime(time);
        this.stats.update(time);
        this.render(time, deltaTime, resized);
        this.onFrameEnd();
    }

    /** When true, continue rendering even when the tab is hidden/backgrounded. */
    runInBackground: boolean = true;

    protected shouldSkipFrame(time: DOMHighResTimeStamp): boolean {
        // Allow background rendering when runInBackground is enabled
        if (this.runInBackground) {
            return false;
        }
        try {
            if (typeof document !== "undefined") {
                const doc = document as Document & {
                    webkitHidden?: boolean;
                    webkitVisibilityState?: DocumentVisibilityState;
                };
                const hidden = doc.hidden || doc.webkitHidden === true;
                const visibilityState =
                    typeof doc.visibilityState === "string"
                        ? doc.visibilityState
                        : doc.webkitVisibilityState;
                if (hidden || visibilityState === "hidden") {
                    this.stats.lastFrameTime = time;
                    return true;
                }
            }
        } catch {
            // Ignore visibility errors and continue rendering
        }
        return false;
    }

    // Helper for React hosts to attach a ResizeObserver to this canvas element.
    // Observes the canvas' content box so changes in parent/layout propagate.
    attachResizeObserver(): void {
        if (this._resizeObs) return;
        try {
            this._resizeObs = new ResizeObserver(() => this.forceResize());
            this._resizeObs.observe(this.canvas);
        } catch {
            // Older browsers: no-op; RAF path will still resize
        }
    }
}
