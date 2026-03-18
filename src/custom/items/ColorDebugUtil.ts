/**
 * Utility for debugging model colors when creating recolored custom items.
 *
 * OSRS HSL Color Format: (hue << 10) | (saturation << 7) | lightness
 * - Hue: 0-63 (0=red, ~10=orange, ~21=green, ~32=gray, ~43=blue, ~51=purple)
 * - Saturation: 0-7 (0=gray, 7=vivid)
 * - Lightness: 0-127 (0=black, 127=white)
 */

/**
 * Enable this flag to log model colors when items are loaded.
 * Set the model ID you want to debug.
 */
export let DEBUG_MODEL_ID: number | null = null;

/**
 * Enable color debugging for a specific model ID.
 * Call this before loading the item to see its colors in console.
 *
 * @example
 * // In browser console:
 * window.debugModelColors(29210); // Bond model
 */
export function enableColorDebug(modelId: number): void {
    DEBUG_MODEL_ID = modelId;
    console.log(`[ColorDebug] Will dump colors for model ${modelId} on next load`);
}

/**
 * Disable color debugging.
 */
export function disableColorDebug(): void {
    DEBUG_MODEL_ID = null;
}

/**
 * Decode an OSRS HSL color value into its components.
 */
export function decodeHSL(color: number): { hue: number; sat: number; light: number } {
    return {
        hue: color >> 10,
        sat: (color >> 7) & 7,
        light: color & 127,
    };
}

/**
 * Encode HSL components into an OSRS color value.
 */
export function encodeHSL(hue: number, sat: number, light: number): number {
    return (hue << 10) | (sat << 7) | light;
}

/**
 * Convert a color from one hue to another, preserving saturation and lightness.
 */
export function recolorHue(color: number, newHue: number): number {
    const { sat, light } = decodeHSL(color);
    return encodeHSL(newHue, sat, light);
}

/**
 * Dump unique colors from a faceColors array.
 * Call this from ObjModelLoader when debugging.
 */
export function dumpModelColors(modelId: number, faceColors: Uint16Array): void {
    const uniqueColors = new Set<number>();
    for (let i = 0; i < faceColors.length; i++) {
        uniqueColors.add(faceColors[i]);
    }
    const sorted = Array.from(uniqueColors).sort((a, b) => a - b);
    console.log(`[Model ${modelId}] Unique face colors (${sorted.length}):`, sorted);
    console.log("[Model] Color breakdown:");
    sorted.forEach((c) => {
        const { hue, sat, light } = decodeHSL(c);
        console.log(`  ${c}: H=${hue}, S=${sat}, L=${light}`);
    });
}

/**
 * Generate recolor arrays for changing all colors of a specific hue range to a new hue.
 *
 * @example
 * // Change green (hue 19-22) to red (hue 0)
 * const { from, to } = generateRecolorArrays(modelColors, 19, 22, 0);
 */
export function generateRecolorArrays(
    colors: number[],
    fromHueMin: number,
    fromHueMax: number,
    toHue: number,
): { from: number[]; to: number[] } {
    const from: number[] = [];
    const to: number[] = [];

    for (const color of colors) {
        const { hue, sat, light } = decodeHSL(color);
        if (hue >= fromHueMin && hue <= fromHueMax) {
            from.push(color);
            to.push(encodeHSL(toHue + (hue - fromHueMin), sat, light));
        }
    }

    return { from, to };
}

// Expose to window for easy console access
if (typeof window !== "undefined") {
    (window as any).debugModelColors = enableColorDebug;
    (window as any).stopDebugColors = disableColorDebug;
    (window as any).decodeHSL = decodeHSL;
    (window as any).encodeHSL = encodeHSL;
}
