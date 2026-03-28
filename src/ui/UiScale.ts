const STORAGE_KEY = "osrs.uiScale";

const MAX_SCALE = 5;

/**
 * How far the raw scale ratio must drop below the current integer scale before
 * the scale decreases. 0.7 means scale=2 holds until the raw ratio is < 1.3
 * (window < ~994px wide), preventing jarring jumps near the boundary.
 * Scale always increases freely (no upward hysteresis).
 */
const SCALE_DOWN_HYSTERESIS = 0.7;

/**
 * Fractional boost applied when auto-scale is 1. At small viewports (below
 * scale=2 threshold) the UI can feel tiny; this bumps the effective scale to
 * 1.1 so long as the resulting layout remains ≥ 765×503 (OSRS minimum).
 * Requires cssW ≥ 842 and cssH ≥ 554 to activate.
 */
const SCALE_1_BOOST = 1.1;

let manualOverride: number | null = null;
let overrideLoaded = false;
let _lastAutoScale: number = 0;

function loadOverride(): number | null {
    if (typeof localStorage === "undefined") return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_SCALE) return null;
        return parsed;
    } catch {
        return null;
    }
}

function ensureOverrideLoaded(): void {
    if (overrideLoaded) return;
    overrideLoaded = true;
    manualOverride = loadOverride();
}

/**
 * Compute the automatic UI scale from CSS viewport dimensions.
 * Scales proportionally relative to the OSRS base resolution (765×503),
 * matching RuneLite-style stretched-mode auto scaling.
 *
 * Hard constraint: scale is capped so the resulting layout is never
 * smaller than 765×503 (OSRS minimum). This uses Math.floor so that
 * e.g. floor(2560/765)=3 but floor(1437/503)=2 → cap=2 at 2560×1437,
 * giving layout 1280×718 with no widget overlap.
 *
 * Stateful hysteresis prevents scale drops on small window resizes: the
 * scale only decreases when the raw ratio drops SCALE_DOWN_HYSTERESIS (0.7)
 * below the current integer scale — but never beyond what the layout cap allows.
 */
export function computeAutoScale(cssW: number, cssH: number): number {
    const OSRS_BASE_W = 765;
    const OSRS_BASE_H = 503;

    // Soft cap: allow layout to be up to CAP_TOLERANCE pixels below the OSRS minimum
    // before forcing a scale drop. This prevents a single-pixel viewport change (e.g.
    // resizing the browser DevTools panel) from flipping between scale=1 and scale=2
    // at the exact 1530px boundary. Layout at scale=2 with 1529px viewport is 764px —
    // visually identical to the 765px minimum, so the tolerance is imperceptible.
    const CAP_TOLERANCE_W = 15;
    const CAP_TOLERANCE_H = 10;
    const maxAllowed = Math.max(
        1,
        Math.min(
            Math.floor(cssW / (OSRS_BASE_W - CAP_TOLERANCE_W)),
            Math.floor(cssH / (OSRS_BASE_H - CAP_TOLERANCE_H)),
            MAX_SCALE,
        ),
    );

    const rawScale = Math.min(cssW / OSRS_BASE_W, cssH / OSRS_BASE_H);
    // Round toward preferred scale, but never exceed the layout-minimum cap.
    const natural = Math.max(1, Math.min(maxAllowed, Math.round(rawScale)));

    // Fractional boost: when natural scale is 1 and the viewport is large enough
    // that a 10% bigger UI still keeps the layout ≥ 765×503, return 1.1 instead.
    // This makes the UI feel less tiny on mid-size screens (e.g. 1366×768, 1440×900)
    // that don't yet qualify for scale=2.
    const boosted = natural === 1
        && cssW / SCALE_1_BOOST >= OSRS_BASE_W
        && cssH / SCALE_1_BOOST >= OSRS_BASE_H
        ? SCALE_1_BOOST
        : natural;

    if (_lastAutoScale <= 0) {
        _lastAutoScale = boosted;
        return boosted;
    }

    if (boosted < _lastAutoScale) {
        // Hysteresis: hold the previous scale as long as the layout cap still allows it
        // and rawScale hasn't dropped far enough to warrant a change.
        const held = Math.min(_lastAutoScale, maxAllowed);
        if (held > boosted && rawScale >= held - SCALE_DOWN_HYSTERESIS) {
            return held;
        }
    }

    _lastAutoScale = boosted;
    return boosted;
}

/**
 * Get the effective UI scale. If the user has set a manual override it takes
 * precedence; otherwise the scale is computed automatically from the viewport.
 */
export function getUiScale(cssW?: number, cssH?: number): number {
    ensureOverrideLoaded();
    if (manualOverride !== null) return manualOverride;
    if (cssW != null && cssH != null) return computeAutoScale(cssW, cssH);
    return 1;
}

/** Set a manual UI scale override and persist it. Pass `null` to clear and revert to auto. */
export function setUiScale(scale: number | null): void {
    overrideLoaded = true;
    if (scale === null) {
        manualOverride = null;
        _lastAutoScale = 0; // Reset so auto-scale re-seeds from the current viewport.
        if (typeof localStorage !== "undefined") {
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
        return;
    }
    const clamped = Math.max(1, Math.min(MAX_SCALE, scale));
    manualOverride = clamped;
    if (typeof localStorage !== "undefined") {
        try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch {}
    }
}
