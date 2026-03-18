import { BitmapFont } from "../../../rs/font/BitmapFont";
import type { GLRenderer } from "../../gl/renderer";

export type FontLoader = (id: number) => BitmapFont | undefined;
export type InlineImageResolver = (
    imgId: number,
) => { canvas: HTMLCanvasElement; width: number; height: number } | undefined;

// ============================================================================
// Performance optimization: Cached helpers and reusable objects
// ============================================================================

// Color string cache to avoid repeated string allocations
const _colorCache = new Map<number, string>();
function toCss(c: number): string {
    let cached = _colorCache.get(c);
    if (!cached) {
        cached = `#${(c >>> 0).toString(16).padStart(6, "0")}`;
        // Limit cache size
        if (_colorCache.size > 256) {
            const first = _colorCache.keys().next().value;
            if (first !== undefined) _colorCache.delete(first);
        }
        _colorCache.set(c, cached);
    }
    return cached;
}

// Single regex for stripping markup (much faster than 12 separate replace calls)
const _stripMarkupRegex = /<\/?(?:col|color|shad|u|str)(?:=[^>]*)?>|<img=\d+>|<br\s*\/?>/gi;

// Reusable measurement canvas/context (singleton)
let _measCanvas: HTMLCanvasElement | null = null;
let _measCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
    if (!_measCtx) {
        _measCanvas = document.createElement("canvas");
        _measCanvas.width = 1;
        _measCanvas.height = 1;
        _measCtx = _measCanvas.getContext("2d")!;
        _measCtx.font = "12px sans-serif";
    }
    return _measCtx;
}

/** Parsed text segment with styling information */
interface TextSegment {
    text: string;
    color: number; // RGB color
    shadow: number; // Shadow color (-1 = default black, -2 = no shadow)
    underline: number; // Underline color (-1 = no underline)
    strikethrough: number; // Strikethrough color (-1 = no strikethrough)
    imgId?: number; // Sprite ID for inline images
}

/**
 * Parse OSRS text markup tags like <col=808080>text</col>
 * Returns an array of text segments with their styling
 */
function parseOsrsMarkup(text: string, defaultColor: number): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentColor = defaultColor;
    let currentShadow = -1; // -1 = default (black if shadow enabled)
    let currentUnderline = -1; // -1 = no underline
    let currentStrikethrough = -1; // -1 = no strikethrough
    let i = 0;

    const makeSegment = (t: string, imgId?: number): TextSegment => ({
        text: t,
        color: currentColor,
        shadow: currentShadow,
        underline: currentUnderline,
        strikethrough: currentStrikethrough,
        imgId,
    });

    while (i < text.length) {
        // Look for opening tag
        if (text[i] === "<") {
            const tagEnd = text.indexOf(">", i);
            if (tagEnd === -1) {
                // No closing >, treat as regular text
                segments.push(makeSegment(text[i]));
                i++;
                continue;
            }

            const tagContent = text.slice(i + 1, tagEnd).toLowerCase();

            // Handle <col=XXXXXX> or <color=XXXXXX> tag (with optional # prefix)
            if (tagContent.startsWith("col=") || tagContent.startsWith("color=")) {
                const prefixLen = tagContent.startsWith("color=") ? 6 : 4;
                let colorStr = tagContent.slice(prefixLen);
                // Strip optional # prefix
                if (colorStr.startsWith("#")) {
                    colorStr = colorStr.slice(1);
                }
                const parsed = parseInt(colorStr, 16);
                if (!isNaN(parsed)) {
                    currentColor = parsed;
                }
                i = tagEnd + 1;
                continue;
            }

            // Handle </col> or </color> closing tag
            if (tagContent === "/col" || tagContent === "/color") {
                currentColor = defaultColor;
                i = tagEnd + 1;
                continue;
            }

            // Handle <br> line break
            if (tagContent === "br" || tagContent === "br/") {
                segments.push(makeSegment("\n"));
                i = tagEnd + 1;
                continue;
            }

            // Handle <shad=XXXXXX> shadow color
            if (tagContent.startsWith("shad=")) {
                const colorStr = tagContent.slice(5);
                const parsed = parseInt(colorStr, 16);
                if (!isNaN(parsed)) {
                    currentShadow = parsed;
                }
                i = tagEnd + 1;
                continue;
            }

            // Handle <shad> default shadow (black)
            if (tagContent === "shad") {
                currentShadow = 0x000000;
                i = tagEnd + 1;
                continue;
            }

            // Handle </shad> - disable shadow
            if (tagContent === "/shad") {
                currentShadow = -2; // -2 = explicitly no shadow
                i = tagEnd + 1;
                continue;
            }

            // Handle <u=XXXXXX> underline with color
            if (tagContent.startsWith("u=")) {
                const colorStr = tagContent.slice(2);
                const parsed = parseInt(colorStr, 16);
                if (!isNaN(parsed)) {
                    currentUnderline = parsed;
                } else {
                    currentUnderline = currentColor; // Use text color
                }
                i = tagEnd + 1;
                continue;
            }

            // Handle <u> default underline (use text color)
            if (tagContent === "u") {
                currentUnderline = 0x000000; // Default underline color
                i = tagEnd + 1;
                continue;
            }

            // Handle </u> - disable underline
            if (tagContent === "/u") {
                currentUnderline = -1;
                i = tagEnd + 1;
                continue;
            }

            // Handle <str> strikethrough
            if (tagContent === "str") {
                currentStrikethrough = 0x800000; // Default RS strikethrough color (dark red)
                i = tagEnd + 1;
                continue;
            }

            // Handle </str> - disable strikethrough
            if (tagContent === "/str") {
                currentStrikethrough = -1;
                i = tagEnd + 1;
                continue;
            }

            // Handle <img=N> inline images
            if (tagContent.startsWith("img=")) {
                const idStr = tagContent.slice(4);
                const imgId = parseInt(idStr, 10);
                if (!isNaN(imgId) && imgId >= 0) {
                    // Add a placeholder segment for the image
                    segments.push(makeSegment("", imgId));
                }
                i = tagEnd + 1;
                continue;
            }

            // Unknown tag, include the < character as text
            segments.push(makeSegment("<"));
            i++;
            continue;
        }

        // Regular character - collect consecutive chars with same styling
        let textChunk = "";
        while (i < text.length && text[i] !== "<") {
            textChunk += text[i];
            i++;
        }
        if (textChunk) {
            segments.push(makeSegment(textChunk));
        }
    }

    return segments;
}

/** Check if text contains OSRS markup tags */
function hasOsrsMarkup(text: string): boolean {
    return /<col=|<\/col>|<color=|<\/color>|<shad|<\/shad>|<br>|<img=|<u>|<u=|<\/u>|<str>|<\/str>/i.test(
        text,
    );
}

/** Strip all OSRS markup tags from text, returning plain text */
function stripOsrsMarkup(text: string): string {
    // Reset regex lastIndex for global regex reuse
    _stripMarkupRegex.lastIndex = 0;
    return text.replace(_stripMarkupRegex, (match) => {
        // <br> becomes newline, everything else is removed
        return match.toLowerCase().startsWith("<br") ? "\n" : "";
    });
}

// Reusable canvas for text rendering to avoid allocation per draw call
let _textCanvas: HTMLCanvasElement | null = null;
let _textCtx: CanvasRenderingContext2D | null = null;

function computeVerticalTextureBounds(widgetH: number, topRaw: number, bottomRaw: number) {
    const minY = Math.min(0, Math.floor(topRaw));
    const maxY = Math.max(widgetH, Math.ceil(bottomRaw));
    return {
        minY,
        maxY,
        canvasH: Math.max(1, maxY - minY),
    };
}

function getTextCanvas(
    w: number,
    h: number,
): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
} {
    if (!_textCanvas) {
        _textCanvas = document.createElement("canvas");
        _textCtx = _textCanvas.getContext("2d", {
            willReadFrequently: true,
        }) as CanvasRenderingContext2D;
    }
    // PERF: Always set exact dimensions - texture upload uses full canvas size
    // Setting dimensions also clears the canvas, so no separate clearRect needed
    if (_textCanvas.width !== w || _textCanvas.height !== h) {
        _textCanvas.width = w;
        _textCanvas.height = h;
    } else {
        // Same size - just clear it
        _textCtx!.clearRect(0, 0, w, h);
    }
    return { canvas: _textCanvas, ctx: _textCtx! };
}

export function drawTextGL(
    glr: GLRenderer,
    fontLoader: FontLoader,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fontId: number,
    color: number,
    xAlign: number = 0,
    yAlign: number = 0,
    shadow: boolean = false,
    alpha: number = 1,
    inlineImageResolver?: InlineImageResolver,
    renderScaleX: number = 1,
    renderScaleY: number = 1,
) {
    // Early exit for empty text
    if (!text || w <= 0 || h <= 0) return;

    const safeScaleX = Number.isFinite(renderScaleX) && renderScaleX > 0 ? renderScaleX : 1;
    const safeScaleY = Number.isFinite(renderScaleY) && renderScaleY > 0 ? renderScaleY : 1;
    const logicalW = Math.max(1, Math.round(w / safeScaleX));
    const logicalH = Math.max(1, Math.round(h / safeScaleY));

    const font = fontLoader(fontId);
    const cssColor = toCss(color);

    // Check for OSRS markup tags
    const useMarkup = hasOsrsMarkup(text);
    const defaultSegment: TextSegment = {
        text,
        color,
        shadow: -1,
        underline: -1,
        strikethrough: -1,
    };
    const segments = useMarkup ? parseOsrsMarkup(text, color) : [defaultSegment];
    const resolveInlineImage = inlineImageResolver ?? (() => undefined);
    const measCtx = getMeasureContext();
    measCtx.font = "14px sans-serif";

    const measureSegmentWidth = (
        segment: TextSegment,
        measureText: (s: string) => number,
    ): number => {
        if (segment.imgId !== undefined) {
            const icon = resolveInlineImage(segment.imgId | 0);
            return icon ? Math.max(0, icon.width | 0) : 0;
        }
        return measureText(segment.text);
    };

    const measureText = (s: string) => {
        if (font) {
            const m = (font as any).measure?.(s);
            if (typeof m === "number") return m | 0;
        }
        return Math.ceil(measCtx.measureText(s).width);
    };

    let totalWidth = 0;
    for (const seg of segments) {
        if (seg.text === "\n") continue;
        totalWidth += measureSegmentWidth(seg, measureText);
    }

    // OSRS parity: text alignment can overflow widget width (used by runmode 116:30)
    // so we expand the cached texture bounds instead of clipping to widget width.
    let txRaw = 0;
    if (xAlign === 1) txRaw = Math.round((logicalW - totalWidth) / 2);
    else if (xAlign === 2) txRaw = logicalW - totalWidth;
    const minX = Math.min(0, txRaw);
    const maxX = Math.max(logicalW, txRaw + totalWidth);
    const canvasW = Math.max(1, Math.ceil(maxX - minX) | 0);
    const texX = (x | 0) + Math.round(minX * safeScaleX);
    const tx = (txRaw - minX) | 0;
    let canvasH = Math.max(1, logicalH | 0);
    let texY = y | 0;
    let baselineY = 0;
    let fontAscent = 0;

    // Reuse cached text textures when available to avoid per-frame uploads
    // Note: alpha is NOT included in key - we apply alpha at draw time, not render time
    if (font) {
        const ascent = (font as any).maxAscent || (font as any).ascent || 0;
        const descent = (font as any).maxDescent || 0;
        fontAscent = ascent;
        const total = ascent + descent;
        baselineY = ascent;
        if (yAlign === 1) baselineY = Math.round((logicalH - total) / 2 + ascent) - 1;
        else if (yAlign === 2) baselineY = Math.max(0, logicalH - descent);

        const bounds = computeVerticalTextureBounds(
            logicalH,
            baselineY - ascent,
            baselineY + descent,
        );
        canvasH = bounds.canvasH;
        texY = (y | 0) + Math.round(bounds.minY * safeScaleY);
        baselineY -= bounds.minY;
    }

    const key = `txt:${canvasW},${canvasH},${fontId},${color},${xAlign},${yAlign},${
        texY - (y | 0)
    },${shadow ? 1 : 0}:${text}`;
    const cached = typeof glr.getTexture === "function" ? glr.getTexture(key) : undefined;
    const drawW = Math.max(1, Math.round(canvasW * safeScaleX));
    const drawH = Math.max(1, Math.round(canvasH * safeScaleY));
    if (cached) {
        glr.drawTexture(cached, texX, texY, drawW, drawH, 1, 1, 0, [0, 0, 0], false, false, alpha);
        return;
    }

    // PERF: Reuse pooled canvas instead of allocating new one each call
    // The texture is cached by key, so we can safely reuse the canvas for rendering
    const { canvas: can, ctx: ctx2 } = getTextCanvas(canvasW, canvasH);

    if (font) {
        const by = baselineY | 0;

        // Draw each segment with its styling
        let cx = tx;
        for (const seg of segments) {
            if (seg.text === "\n") continue; // Skip line breaks in single-line mode

            if (seg.imgId !== undefined) {
                const icon = resolveInlineImage(seg.imgId | 0);
                if (icon) {
                    const iconW = Math.max(0, icon.width | 0);
                    const iconH = Math.max(0, icon.height | 0);
                    if (iconW > 0 && iconH > 0) {
                        ctx2.drawImage(icon.canvas, cx, by - iconH, iconW, iconH);
                    }
                    cx += iconW;
                }
                continue;
            }

            const segCss = toCss(seg.color);
            const segWidth = measureText(seg.text);

            // Determine shadow color for this segment
            const shouldShadow = shadow || seg.shadow >= 0;
            const shadowCss = seg.shadow >= 0 ? toCss(seg.shadow) : "#000000";

            if (shouldShadow && seg.shadow !== -2) {
                (font as any).draw(ctx2, seg.text, cx + 1, by + 1, shadowCss);
            }
            (font as any).draw(ctx2, seg.text, cx, by, segCss);

            // Draw underline
            if (seg.underline >= 0) {
                const uCss = toCss(seg.underline);
                ctx2.fillStyle = uCss;
                ctx2.fillRect(cx, by + 2, segWidth, 1);
            }

            // Draw strikethrough
            if (seg.strikethrough >= 0) {
                const sCss = toCss(seg.strikethrough);
                ctx2.fillStyle = sCss;
                const strikeY = by - Math.floor(fontAscent * 0.3);
                ctx2.fillRect(cx, strikeY, segWidth, 1);
            }

            cx += segWidth;
        }
    } else {
        ctx2.font = "14px sans-serif";
        ctx2.textBaseline = "middle";
        const cy =
            yAlign === 1
                ? Math.floor(canvasH / 2)
                : yAlign === 2
                ? canvasH - 2
                : Math.floor(canvasH / 2);

        if (!useMarkup) {
            // Simple case - no markup
            if (shadow) {
                ctx2.fillStyle = "#000";
                ctx2.fillText(text, tx + 1, cy + 1);
            }
            ctx2.fillStyle = cssColor;
            ctx2.fillText(text, tx, cy);
        } else {
            // Draw segments - fallback for no bitmap font
            let drawX = tx;
            for (const seg of segments) {
                if (seg.text === "\n") continue;

                if (seg.imgId !== undefined) {
                    const icon = resolveInlineImage(seg.imgId | 0);
                    if (icon) {
                        const iconW = Math.max(0, icon.width | 0);
                        const iconH = Math.max(0, icon.height | 0);
                        if (iconW > 0 && iconH > 0) {
                            ctx2.drawImage(
                                icon.canvas,
                                drawX,
                                Math.floor(cy - iconH / 2),
                                iconW,
                                iconH,
                            );
                        }
                        drawX += iconW;
                    }
                    continue;
                }

                const segCss = toCss(seg.color);
                const segWidth = ctx2.measureText(seg.text).width;

                // Determine shadow for this segment
                const shouldShadow = shadow || seg.shadow >= 0;
                const shadowCss = seg.shadow >= 0 ? toCss(seg.shadow) : "#000";

                if (shouldShadow && seg.shadow !== -2) {
                    ctx2.fillStyle = shadowCss;
                    ctx2.fillText(seg.text, drawX + 1, cy + 1);
                }
                ctx2.fillStyle = segCss;
                ctx2.fillText(seg.text, drawX, cy);

                // Draw underline
                if (seg.underline >= 0) {
                    ctx2.fillStyle = toCss(seg.underline);
                    ctx2.fillRect(drawX, cy + 8, segWidth, 1);
                }

                // Draw strikethrough
                if (seg.strikethrough >= 0) {
                    ctx2.fillStyle = toCss(seg.strikethrough);
                    ctx2.fillRect(drawX, cy, segWidth, 1);
                }

                drawX += segWidth;
            }
        }
    }
    const tex = glr.createTextureFromCanvas(key, can);
    glr.drawTexture(tex, texX, texY, drawW, drawH, 1, 1, 0, [0, 0, 0], false, false, alpha);
}

export function wrapTextToWidth(
    text: string,
    maxW: number,
    measure: (s: string) => number,
): string[] {
    const normalized = String(text).replace(/<br\s*\/?\s*>/gi, "\n");
    const paragraphs = normalized.split(/\n/);
    const out: string[] = [];
    for (const para of paragraphs) {
        const p = para;
        const words = p.split(/\s+/);
        if (words.length === 1 && words[0] === "") {
            out.push("");
            continue;
        }
        let cur = "";
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (!w) continue;
            if (!cur) {
                // OSRS parity: single words that don't fit are NOT broken character-by-character.
                // They are kept intact and allowed to overflow/clip. This prevents stat levels
                // like "99" from being broken into "9" + "9" on separate lines.
                cur = w;
            } else {
                const test = cur + " " + w;
                if (measure(test) <= maxW) cur = test;
                else {
                    out.push(cur);
                    // Same here - don't break long words, keep them whole
                    cur = w;
                }
            }
        }
        if (cur) out.push(cur);
    }
    return out;
}

export function splitExplicitLineBreaks(text: string): string[] {
    return String(text)
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .split(/\n/);
}

export function shouldAutoWrapText(
    widgetHeight: number,
    lineHeight: number,
    maxAscent: number,
    maxDescent: number,
): boolean {
    const resolvedLineHeight = Math.max(1, lineHeight | 0);
    const ascent = Math.max(0, maxAscent | 0);
    const descent = Math.max(0, maxDescent | 0);
    const height = Math.max(0, widgetHeight | 0);
    return !(height < resolvedLineHeight + ascent + descent && height < resolvedLineHeight * 2);
}

export function drawWrappedTextGL(
    glr: GLRenderer,
    fontLoader: FontLoader,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fontId: number,
    color: number,
    lineHeight: number = 12,
    shadow: boolean = true,
    yAlign: 0 | 1 | 2 = 1,
    xAlign: 0 | 1 | 2 = 1,
    inlineImageResolver?: InlineImageResolver,
    renderScaleX: number = 1,
    renderScaleY: number = 1,
) {
    // Early exit for empty text
    if (!text || w <= 0 || h <= 0) return;

    const safeScaleX = Number.isFinite(renderScaleX) && renderScaleX > 0 ? renderScaleX : 1;
    const safeScaleY = Number.isFinite(renderScaleY) && renderScaleY > 0 ? renderScaleY : 1;
    const logicalW = Math.max(1, Math.round(w / safeScaleX));
    const logicalH = Math.max(1, Math.round(h / safeScaleY));

    const font = fontLoader(fontId);
    const cssColor = toCss(color);
    const measCtx = getMeasureContext();
    const useMarkup = hasOsrsMarkup(text);
    const resolveInlineImage = inlineImageResolver ?? (() => undefined);

    // Measure plain text (strip markup for accurate width calculation)
    const measure = (s: string) => {
        const plain = stripOsrsMarkup(s);
        try {
            const m = (font as any)?.measure?.(plain);
            if (typeof m === "number") return m | 0;
        } catch {}
        measCtx.font = "12px sans-serif";
        return Math.ceil(measCtx.measureText(plain).width);
    };
    const resolvedLineHeight = Math.max(
        1,
        lineHeight | 0 ||
            ((font as any)?.lineHeight as number) ||
            ((font as any)?.ascent as number) ||
            12,
    );
    const maxAscent = ((font as any)?.maxAscent ?? (font as any)?.ascent ?? resolvedLineHeight) | 0;
    const maxDescent = ((font as any)?.maxDescent ?? 0) | 0;
    const autoWrap = shouldAutoWrapText(logicalH, resolvedLineHeight, maxAscent, maxDescent);
    // OSRS parity: short text widgets disable automatic wrapping and only honor explicit <br>.
    const lines = autoWrap
        ? wrapTextToWidth(text, Math.max(1, logicalW), measure)
        : splitExplicitLineBreaks(text);

    const measureRaw = (s: string) => {
        if (font) {
            const m = (font as any)?.measure?.(s);
            if (typeof m === "number") return m | 0;
        }
        measCtx.font = "12px sans-serif";
        return Math.ceil(measCtx.measureText(s).width);
    };

    const lineSegments: (TextSegment[] | null)[] = new Array(lines.length);
    const lineWidths: number[] = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
        if (useMarkup) {
            const segs = parseOsrsMarkup(lines[i], color);
            lineSegments[i] = segs;
            let width = 0;
            for (const seg of segs) {
                if (seg.text === "\n") continue;
                if (seg.imgId !== undefined) {
                    const icon = resolveInlineImage(seg.imgId | 0);
                    if (icon) width += Math.max(0, icon.width | 0);
                    continue;
                }
                width += measureRaw(seg.text);
            }
            lineWidths[i] = width;
        } else {
            lineSegments[i] = null;
            lineWidths[i] = measureRaw(lines[i]);
        }
    }

    // OSRS parity: x alignment can overflow widget width (e.g. runmode percent text in 116:30).
    const lineOffsetsRaw: number[] = new Array(lines.length);
    let minTx = 0;
    let maxTx = logicalW;
    for (let i = 0; i < lines.length; i++) {
        const tw = lineWidths[i] ?? 0;
        let txRaw = 0;
        if (xAlign === 1) txRaw = Math.round((logicalW - tw) / 2);
        else if (xAlign === 2) txRaw = logicalW - tw;
        lineOffsetsRaw[i] = txRaw;
        if (txRaw < minTx) minTx = txRaw;
        const right = txRaw + tw;
        if (right > maxTx) maxTx = right;
    }
    const canvasW = Math.max(1, Math.ceil(maxTx - minTx) | 0);
    const texX = (x | 0) + Math.round(minTx * safeScaleX);
    let canvasH = Math.max(1, logicalH | 0);
    let texY = y | 0;
    let baseY0 = 0;

    // Try cache after computing effective text bounds
    if (font) {
        const ascent = (font as any).maxAscent || (font as any).ascent || 0;
        const descent = (font as any).maxDescent || 0;
        const totalH = Math.max(resolvedLineHeight, lines.length * resolvedLineHeight);
        baseY0 = ascent;
        if (yAlign === 1) baseY0 = Math.round((logicalH - totalH) / 2) + ascent - 1;
        else if (yAlign === 2) baseY0 = Math.max(0, logicalH - totalH) + ascent - 1;
        const lastBaseline = baseY0 + Math.max(0, lines.length - 1) * resolvedLineHeight;
        const bounds = computeVerticalTextureBounds(
            logicalH,
            baseY0 - ascent,
            lastBaseline + descent,
        );
        canvasH = bounds.canvasH;
        texY = (y | 0) + Math.round(bounds.minY * safeScaleY);
        baseY0 -= bounds.minY;
    }

    const baseKey = `txtwrap:${logicalW},${logicalH},${canvasW},${canvasH},${minTx},${
        texY - (y | 0)
    },${fontId},${color},${resolvedLineHeight},${shadow ? 1 : 0},${yAlign},${xAlign},${
        autoWrap ? 1 : 0
    }:${text}`;
    const cachedBase = typeof glr.getTexture === "function" ? glr.getTexture(baseKey) : undefined;
    const drawW = Math.max(1, Math.round(canvasW * safeScaleX));
    const drawH = Math.max(1, Math.round(canvasH * safeScaleY));
    if (cachedBase) {
        glr.drawTexture(cachedBase, texX, texY, drawW, drawH, 1, 1);
        return;
    }

    const can = document.createElement("canvas");
    can.width = canvasW;
    can.height = canvasH;
    const ctx2 = can.getContext("2d", {
        willReadFrequently: true as any,
    }) as CanvasRenderingContext2D;

    if (font) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const by = baseY0 + i * resolvedLineHeight;
            const tx = (lineOffsetsRaw[i] - minTx) | 0;

            if (useMarkup) {
                const segments = lineSegments[i] ?? parseOsrsMarkup(line, color);
                let cx = tx;
                for (const seg of segments) {
                    if (seg.text === "\n") continue;

                    if (seg.imgId !== undefined) {
                        const icon = resolveInlineImage(seg.imgId | 0);
                        if (icon) {
                            const iconW = Math.max(0, icon.width | 0);
                            const iconH = Math.max(0, icon.height | 0);
                            if (iconW > 0 && iconH > 0) {
                                ctx2.drawImage(icon.canvas, cx, by - iconH, iconW, iconH);
                            }
                            cx += iconW;
                        }
                        continue;
                    }

                    const segCss = toCss(seg.color);
                    const segWidth = ((font as any).measure?.(seg.text) | 0) as number;
                    const shouldShadow = shadow || seg.shadow >= 0;
                    const shadowCss = seg.shadow >= 0 ? toCss(seg.shadow) : "#000000";
                    if (shouldShadow && seg.shadow !== -2) {
                        (font as any).draw(ctx2, seg.text, cx + 1, by + 1, shadowCss);
                    }
                    (font as any).draw(ctx2, seg.text, cx, by, segCss);
                    cx += segWidth;
                }
            } else {
                // No markup - simple rendering
                if (shadow) (font as any).draw(ctx2, line, tx + 1, by + 1, "#000000");
                (font as any).draw(ctx2, line, tx, by, cssColor);
            }
        }
    } else {
        ctx2.textBaseline = "top";
        ctx2.font = "12px sans-serif";
        const totalH = Math.max(resolvedLineHeight, lines.length * resolvedLineHeight);
        let y0 = 0;
        if (yAlign === 1) y0 = Math.round((canvasH - totalH) / 2);
        else if (yAlign === 2) y0 = Math.max(0, canvasH - totalH);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const ty = y0 + i * resolvedLineHeight;
            const tx = (lineOffsetsRaw[i] - minTx) | 0;

            if (useMarkup) {
                const segments = lineSegments[i] ?? parseOsrsMarkup(line, color);
                let drawX = tx;
                for (const seg of segments) {
                    if (seg.text === "\n") continue;

                    if (seg.imgId !== undefined) {
                        const icon = resolveInlineImage(seg.imgId | 0);
                        if (icon) {
                            const iconW = Math.max(0, icon.width | 0);
                            const iconH = Math.max(0, icon.height | 0);
                            if (iconW > 0 && iconH > 0) {
                                ctx2.drawImage(
                                    icon.canvas,
                                    drawX,
                                    Math.floor(ty + (resolvedLineHeight - iconH) / 2),
                                    iconW,
                                    iconH,
                                );
                            }
                            drawX += iconW;
                        }
                        continue;
                    }

                    const segCss = toCss(seg.color);
                    const segWidth = ctx2.measureText(seg.text).width;
                    const shouldShadow = shadow || seg.shadow >= 0;
                    const shadowCss = seg.shadow >= 0 ? toCss(seg.shadow) : "#000";
                    if (shouldShadow && seg.shadow !== -2) {
                        ctx2.fillStyle = shadowCss;
                        ctx2.fillText(seg.text, drawX + 1, ty + 1);
                    }
                    ctx2.fillStyle = segCss;
                    ctx2.fillText(seg.text, drawX, ty);
                    drawX += segWidth;
                }
            } else {
                // No markup - simple rendering
                if (shadow) {
                    ctx2.fillStyle = "#000";
                    ctx2.fillText(line, tx + 1, ty + 1);
                }
                ctx2.fillStyle = cssColor;
                ctx2.fillText(line, tx, ty);
            }
        }
    }
    const tex = glr.createTextureFromCanvas(baseKey, can);
    glr.drawTexture(tex, texX, texY, drawW, drawH, 1, 1);
}

export function drawRichTextGL(
    glr: GLRenderer,
    fontLoader: FontLoader,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fontId: number,
    defaultColor: number,
    xAlign: number = 0,
    yAlign: number = 0,
    shadow: boolean = false,
    highlightRegex?: RegExp,
    highlightColor?: number,
    renderScaleX: number = 1,
    renderScaleY: number = 1,
) {
    const safeScaleX = Number.isFinite(renderScaleX) && renderScaleX > 0 ? renderScaleX : 1;
    const safeScaleY = Number.isFinite(renderScaleY) && renderScaleY > 0 ? renderScaleY : 1;
    const logicalW = Math.max(1, Math.round(w / safeScaleX));
    const logicalH = Math.max(1, Math.round(h / safeScaleY));
    // Cache rich text by content and metrics
    const key = `txtrich:${logicalW},${logicalH},${fontId},${defaultColor},${xAlign},${yAlign},${
        shadow ? 1 : 0
    },${highlightRegex?.source ?? ""},${highlightRegex?.flags ?? ""},${
        highlightColor ?? -1
    }:${text}`;
    const cached = typeof glr.getTexture === "function" ? glr.getTexture(key) : undefined;
    const drawW = Math.max(1, Math.round(logicalW * safeScaleX));
    const drawH = Math.max(1, Math.round(logicalH * safeScaleY));
    if (cached) {
        glr.drawTexture(cached, x, y, drawW, drawH, 1, 1);
        return;
    }

    const can = document.createElement("canvas");
    can.width = logicalW;
    can.height = logicalH;
    const ctx2 = can.getContext("2d", {
        willReadFrequently: true as any,
    }) as CanvasRenderingContext2D;
    const font = fontLoader(fontId);
    const cssDefault = toCss(defaultColor);
    const cssHilite = highlightColor != null ? toCss(highlightColor) : undefined;
    const parts: { text: string; color: string }[] = [];
    if (highlightRegex && cssHilite) {
        let idx = 0;
        let m: RegExpExecArray | null;
        const re = new RegExp(highlightRegex.source, highlightRegex.flags);
        while ((m = re.exec(text))) {
            const s = m.index;
            const e = s + m[0].length;
            if (e <= s) {
                re.lastIndex = e + 1;
                continue;
            }
            if (s > idx) parts.push({ text: text.slice(idx, s), color: cssDefault });
            parts.push({ text: text.slice(s, e), color: cssHilite });
            idx = e;
        }
        if (idx < text.length) parts.push({ text: text.slice(idx), color: cssDefault });
    } else {
        parts.push({ text, color: cssDefault });
    }
    if (font) {
        const ascent = (font as any).maxAscent || (font as any).ascent || 0;
        const descent = (font as any).maxDescent || 0;
        const total = ascent + descent;
        let by = ascent;
        if (yAlign === 1) by = Math.round((logicalH - total) / 2 + ascent) - 1;
        else if (yAlign === 2) by = Math.max(0, logicalH - descent);
        let cx = 0;
        if (xAlign === 1) cx = 0; // for rich text, measure and center per run below
        else if (xAlign === 2) cx = Math.max(0, logicalW); // right align baseline start
        for (const p of parts) {
            if (shadow) (font as any).draw(ctx2, p.text, cx + 1, by + 1, "#000000");
            (font as any).draw(ctx2, p.text, cx, by, p.color);
            cx += (font as any).measure?.(p.text) | 0;
        }
    } else {
        ctx2.fillStyle = cssDefault;
        ctx2.font = "14px sans-serif";
        ctx2.textBaseline = "middle";
        ctx2.textAlign = xAlign === 1 ? "center" : xAlign === 2 ? "right" : "left";
        const cx = xAlign === 1 ? Math.floor(logicalW / 2) : xAlign === 2 ? logicalW - 2 : 0;
        const cy =
            yAlign === 1
                ? Math.floor(logicalH / 2)
                : yAlign === 2
                ? logicalH - 2
                : Math.floor(logicalH / 2);
        for (const p of parts) {
            if (shadow) {
                ctx2.fillStyle = "#000";
                ctx2.fillText(p.text, cx + 1, cy + 1);
                ctx2.fillStyle = p.color;
            } else {
                ctx2.fillStyle = p.color;
            }
            ctx2.fillText(p.text, cx, cy);
        }
    }
    const tex = glr.createTextureFromCanvas(key, can);
    glr.drawTexture(tex, x, y, drawW, drawH, 1, 1);
}
