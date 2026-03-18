import { FONT_PLAIN_11 } from "../../fonts";
import type { GLRenderer } from "../../gl/renderer";
import { drawTextGL } from "./TextRenderer";

// Shared item slot renderer used across bank, deathkeep and temple trekking rewards
// Keeps icon scaling, quantity text, hover/press effects and click registration consistent.
export interface ItemSlotOptions {
    // Position and size
    x: number;
    y: number;
    w: number;
    h: number;
    // Interaction id (optional). When provided and clicks is passed, hover/press will be tracked
    id?: string;
    // Item identity (optional). If omitted, draws only an empty slot backdrop if configured
    itemId?: number;
    quantity?: number;
    // Visual options
    scaleUp?: boolean; // allow upscaling smaller icons to fit. Default false
    showQty?: boolean; // draw stack count text when quantity > 1. Default true
    selected?: boolean; // draw selected highlight
    hoverBorder?: boolean; // draw hover border when hovered
    pressedTint?: number; // icon tint amount while pressed (0..1)
    pressedOverride?: boolean; // force pressed state regardless of clicks registry
    borderHoverColor?: [number, number, number, number];
    borderSelectedColor?: [number, number, number, number];
    // Selection style: rectangle (existing) or sprite-outline (white stroke around icon)
    selectedOutlineStyle?: "rect" | "sprite";
    spriteOutlineColor?: [number, number, number, number];
    spriteOutlineSize?: number; // pixels around icon (screen space), default 1
    emptyBackdropColor?: [number, number, number, number]; // fill used when no itemId
    // Services
    glr: GLRenderer; // render backend with drawTexture/drawRect
    textures: { getItemIconById?: (id: number, qty?: number) => any } & Record<string, any>;
    fontLoader: (id: number) => any;
    clicks?: any; // click registry: { isPressed?, isHover?, register? }
    objLoader?: { load?: (id: number) => any } | any; // for tooltip name resolution
    // Tooltip override and click callback
    hoverText?: string;
    onClick?: (info: { label?: string }) => void;
    onDown?: () => void;
    onUp?: () => void;
}

export function drawItemSlot(opts: ItemSlotOptions) {
    const {
        x,
        y,
        w,
        h,
        id,
        itemId,
        quantity = 1,
        scaleUp = false,
        showQty = true,
        selected = false,
        hoverBorder = false,
        pressedTint = 0,
        borderHoverColor = [148 / 255, 163 / 255, 184 / 255, 0.9] as [
            number,
            number,
            number,
            number,
        ],
        borderSelectedColor = [1, 1, 1, 1] as [number, number, number, number],
        selectedOutlineStyle = "rect",
        spriteOutlineColor = [1, 1, 1, 1] as [number, number, number, number],
        spriteOutlineSize = 1,
        emptyBackdropColor,
        glr,
        textures,
        fontLoader,
        clicks,
        objLoader,
        hoverText,
        onClick,
        pressedOverride,
    } = opts;

    const hovered = !!(id && clicks?.isHover?.(id));
    const pressed =
        typeof pressedOverride === "boolean" ? pressedOverride : !!(id && clicks?.isPressed?.(id));

    // Backdrop for empty slots when requested
    if ((itemId === undefined || itemId === null) && emptyBackdropColor) {
        glr.drawRect(x, y, w, h, emptyBackdropColor);
    }

    // Optional hover border (rectangular)
    if (hoverBorder && hovered) {
        const col = borderHoverColor;
        glr.drawRect(x, y, w, 1, col);
        glr.drawRect(x, y + h - 1, w, 1, col);
        glr.drawRect(x, y, 1, h, col);
        glr.drawRect(x + w - 1, y, 1, h, col);
    }
    // Selected rectangular border (only when using 'rect' style)
    if (selected && selectedOutlineStyle !== "sprite") {
        const col = borderSelectedColor;
        glr.drawRect(x, y, w, 1, col);
        glr.drawRect(x, y + h - 1, w, 1, col);
        glr.drawRect(x, y, 1, h, col);
        glr.drawRect(x + w - 1, y, 1, h, col);
    }

    // Icon
    let computedLabel: string | undefined = undefined;
    // Track drawn icon rect so qty text can anchor to the icon, not the slot
    let iconDx = x;
    let iconDy = y;
    let iconDw = Math.max(1, w);
    let iconDh = Math.max(1, h);
    if (typeof itemId === "number" && itemId >= 0) {
        const tex = (textures as any).getItemIconById?.(itemId, quantity);
        if (tex) {
            const scale = Math.min(
                scaleUp ? 999 : 1,
                w / Math.max(1, tex.w),
                h / Math.max(1, tex.h),
            );
            const dw = Math.max(1, Math.floor(tex.w * scale));
            const dh = Math.max(1, Math.floor(tex.h * scale));
            const dx = x + Math.floor((w - dw) / 2);
            const dy = y + Math.floor((h - dh) / 2);
            // Save the final icon rect for subsequent overlays (e.g., quantity text)
            iconDx = dx;
            iconDy = dy;
            iconDw = dw;
            iconDh = dh;
            // Selected sprite-outline: draw white-tinted copies around the icon, then the icon on top
            if (selected && selectedOutlineStyle === "sprite") {
                const o = Math.max(1, spriteOutlineSize | 0);
                const tintAmt = 1; // full tint towards spriteOutlineColor
                const c = spriteOutlineColor as any; // [r,g,b,a], backend uses rgb and tintAmt
                // 4-neighbour outline for a crisp 1px stroke
                glr.drawTexture(tex, dx - o, dy + 0, dw, dh, 1, 1, tintAmt, [c[0], c[1], c[2]]);
                glr.drawTexture(tex, dx + o, dy + 0, dw, dh, 1, 1, tintAmt, [c[0], c[1], c[2]]);
                glr.drawTexture(tex, dx + 0, dy - o, dw, dh, 1, 1, tintAmt, [c[0], c[1], c[2]]);
                glr.drawTexture(tex, dx + 0, dy + o, dw, dh, 1, 1, tintAmt, [c[0], c[1], c[2]]);
            }
            glr.drawTexture(tex, dx, dy, dw, dh, 1, 1, pressed ? pressedTint : 0, [0, 0, 0]);
        }
        // Quantity devoverlay
        // Quantity overlay — anchor to the item icon's top-left and left-align text
        if (showQty && quantity > 1) {
            const color = qtyColor(quantity);
            (drawTextGL as any)(
                glr,
                fontLoader,
                formatQty(quantity),
                iconDx + 2,
                iconDy + 0,
                Math.max(1, iconDw - 4),
                Math.min(14, Math.max(12, Math.floor(iconDh * 0.5))),
                FONT_PLAIN_11,
                color,
                0,
                0,
                true,
            );
        }
        // Tooltip label default — compute lazily only when hovered to avoid per-frame cache loads
        if (hoverText) {
            computedLabel = hoverText;
        } else if (hovered) {
            try {
                const ot = objLoader?.load?.(itemId);
                const raw = ot?.name as string | undefined;
                let name =
                    typeof raw === "string" && raw.trim() && raw.toLowerCase() !== "null"
                        ? raw.trim()
                        : `Item ${itemId}`;
                const q = quantity | 0;
                const qtyLabel = q > 1 && showQty ? ` x ${formatQty(q)}` : "";
                computedLabel = `${name}${qtyLabel}`;
            } catch {
                computedLabel = `Item ${itemId}`;
            }
        }
    }

    // Click registration and callback
    if (id && clicks?.register) {
        try {
            clicks.register({
                id,
                rect: { x, y, w, h },
                hoverText: computedLabel,
                onClick: () => onClick?.({ label: computedLabel }),
                onDown: () => opts.onDown?.(),
                onUp: () => opts.onUp?.(),
            });
        } catch {}
    }
}

function qtyColor(q: number): number {
    if (q >= 10_000_000) return 0x00ff00; // green
    if (q >= 100_000) return 0xffffff; // white
    return 0xffff00; // yellow
}

function formatQty(n: number): string {
    if (n >= 10_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}
