import { useEffect } from "react";

function readViewportCssSize(): { width: number; height: number } {
    if (typeof window === "undefined") {
        return { width: 0, height: 0 };
    }

    const viewport = window.visualViewport;
    if (viewport) {
        return {
            width: Math.max(1, viewport.width),
            height: Math.max(1, viewport.height),
        };
    }

    return {
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
    };
}

export function useViewportCssVars(): void {
    useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        const root = document.documentElement;
        let rafId: number | undefined;

        const applyViewportMetrics = () => {
            const { width, height } = readViewportCssSize();
            root.style.setProperty("--app-vw", `${width}px`);
            root.style.setProperty("--app-vh", `${height}px`);
        };

        const scheduleApply = () => {
            if (rafId !== undefined) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(() => {
                rafId = undefined;
                applyViewportMetrics();
            });
        };

        scheduleApply();

        window.addEventListener("resize", scheduleApply);
        window.addEventListener("orientationchange", scheduleApply);
        window.addEventListener("pageshow", scheduleApply);
        document.addEventListener("visibilitychange", scheduleApply);

        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", scheduleApply);
        viewport?.addEventListener("scroll", scheduleApply);

        return () => {
            window.removeEventListener("resize", scheduleApply);
            window.removeEventListener("orientationchange", scheduleApply);
            window.removeEventListener("pageshow", scheduleApply);
            document.removeEventListener("visibilitychange", scheduleApply);
            viewport?.removeEventListener("resize", scheduleApply);
            viewport?.removeEventListener("scroll", scheduleApply);
            if (rafId !== undefined) {
                cancelAnimationFrame(rafId);
            }
            root.style.removeProperty("--app-vw");
            root.style.removeProperty("--app-vh");
        };
    }, []);
}
