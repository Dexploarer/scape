// OSRS brightness levels (lower value = brighter)
export const BRIGHTNESS_MAX = 0.6;
export const BRIGHTNESS_HIGH = 0.7;
export const BRIGHTNESS_LOW = 0.8;
export const BRIGHTNESS_MIN = 0.9;
export const BRIGHTNESS_MINIMAP = 0.949999988079071;

// HSL format offsets (0.5/64.0 and 0.5/8.0)
const HUE_OFFSET = 0.0078125;
const SATURATION_OFFSET = 0.0625;

export function buildPalette(brightness: number, var2: number, var3: number): Int32Array {
    const palette = new Int32Array(0xffff);

    let paletteIndex = var2 * 128;

    for (let var5 = var2; var5 < var3; var5++) {
        const var6 = (var5 >> 3) / 64.0 + HUE_OFFSET;
        const var8 = (var5 & 7) / 8.0 + SATURATION_OFFSET;

        for (let var10 = 0; var10 < 128; var10++) {
            const var11 = var10 / 128.0;
            let var13 = var11;
            let var15 = var11;
            let var17 = var11;
            if (var8 !== 0.0) {
                let var19: number;
                if (var11 < 0.5) {
                    var19 = var11 * (1.0 + var8);
                } else {
                    var19 = var11 + var8 - var11 * var8;
                }

                const var21 = 2.0 * var11 - var19;
                let var23 = var6 + 0.3333333333333333;
                if (var23 > 1.0) {
                    var23--;
                }

                let var27 = var6 - 0.3333333333333333;
                if (var27 < 0.0) {
                    var27++;
                }

                if (6.0 * var23 < 1.0) {
                    var13 = var21 + (var19 - var21) * 6.0 * var23;
                } else if (2.0 * var23 < 1.0) {
                    var13 = var19;
                } else if (3.0 * var23 < 2.0) {
                    var13 = var21 + (var19 - var21) * (0.6666666666666666 - var23) * 6.0;
                } else {
                    var13 = var21;
                }

                if (6.0 * var6 < 1.0) {
                    var15 = var21 + (var19 - var21) * 6.0 * var6;
                } else if (2.0 * var6 < 1.0) {
                    var15 = var19;
                } else if (3.0 * var6 < 2.0) {
                    var15 = var21 + (var19 - var21) * (0.6666666666666666 - var6) * 6.0;
                } else {
                    var15 = var21;
                }

                if (6.0 * var27 < 1.0) {
                    var17 = var21 + (var19 - var21) * 6.0 * var27;
                } else if (2.0 * var27 < 1.0) {
                    var17 = var19;
                } else if (3.0 * var27 < 2.0) {
                    var17 = var21 + (var19 - var21) * (0.6666666666666666 - var27) * 6.0;
                } else {
                    var17 = var21;
                }
            }

            const r = (var13 * 256.0) | 0;
            const g = (var15 * 256.0) | 0;
            const b = (var17 * 256.0) | 0;
            let rgb = (r << 16) + (g << 8) + b;

            rgb = brightenRgb(rgb, brightness);
            if (rgb === 0) {
                rgb = 1;
            }

            palette[paletteIndex++] = rgb;
        }
    }

    return palette;
}

// Main color palette (brightness 0.8)
export const HSL_RGB_MAP = buildPalette(BRIGHTNESS_LOW, 0, 512);

// Minimap color palette (brightness ~0.95, appears brighter/lighter)
export const MINIMAP_HSL_RGB_MAP = buildMinimapPalette();

function buildMinimapPalette(): Int32Array {
    const palette = new Int32Array(65536);
    const brightness = BRIGHTNESS_MINIMAP;

    for (let i = 0; i < 65536; i++) {
        const hue = HUE_OFFSET + ((i >> 10) & 63) / 64.0;
        const saturation = SATURATION_OFFSET + ((i >> 7) & 7) / 8.0;
        const luminance = (i & 127) / 128.0;

        let r = luminance;
        let g = luminance;
        let b = luminance;

        if (saturation !== 0.0) {
            let var15: number;
            if (luminance < 0.5) {
                var15 = (1.0 + saturation) * luminance;
            } else {
                var15 = luminance + saturation - saturation * luminance;
            }

            const var17 = 2.0 * luminance - var15;
            let var19 = 0.3333333333333333 + hue;
            if (var19 > 1.0) {
                var19--;
            }

            let var23 = hue - 0.3333333333333333;
            if (var23 < 0.0) {
                var23++;
            }

            if (var19 * 6.0 < 1.0) {
                r = var17 + 6.0 * (var15 - var17) * var19;
            } else if (2.0 * var19 < 1.0) {
                r = var15;
            } else if (var19 * 3.0 < 2.0) {
                r = (0.6666666666666666 - var19) * (var15 - var17) * 6.0 + var17;
            } else {
                r = var17;
            }

            if (hue * 6.0 < 1.0) {
                g = 6.0 * (var15 - var17) * hue + var17;
            } else if (hue * 2.0 < 1.0) {
                g = var15;
            } else if (hue * 3.0 < 2.0) {
                g = var17 + (var15 - var17) * (0.6666666666666666 - hue) * 6.0;
            } else {
                g = var17;
            }

            if (6.0 * var23 < 1.0) {
                b = var17 + 6.0 * (var15 - var17) * var23;
            } else if (2.0 * var23 < 1.0) {
                b = var15;
            } else if (3.0 * var23 < 2.0) {
                b = var17 + (var15 - var17) * (0.6666666666666666 - var23) * 6.0;
            } else {
                b = var17;
            }
        }

        r = Math.pow(r, brightness);
        g = Math.pow(g, brightness);
        b = Math.pow(b, brightness);

        const ri = (256.0 * r) | 0;
        const gi = (256.0 * g) | 0;
        const bi = (b * 256.0) | 0;
        palette[i] = (bi + (gi << 8) + (ri << 16)) & 0xffffff;
    }

    return palette;
}

export const INVALID_HSL_COLOR = 12345678;

// Unpack HSL components from packed 16-bit format
export function unpackHue(hsl: number): number {
    return (hsl >> 10) & 63;
}

export function unpackSaturation(hsl: number): number {
    return (hsl >> 7) & 7;
}

export function unpackLuminance(hsl: number): number {
    return hsl & 127;
}

export function brightenRgb(rgb: number, brightness: number) {
    let r = (rgb >> 16) / 256.0;
    let g = ((rgb >> 8) & 255) / 256.0;
    let b = (rgb & 255) / 256.0;
    r = Math.pow(r, brightness);
    g = Math.pow(g, brightness);
    b = Math.pow(b, brightness);
    const newR = (r * 256.0) | 0;
    const newG = (g * 256.0) | 0;
    const newB = (b * 256.0) | 0;
    return (newR << 16) | (newG << 8) | newB;
}

export function packHsl(hue: number, saturation: number, lightness: number) {
    if (lightness > 179) {
        saturation = (saturation / 2) | 0;
    }

    if (lightness > 192) {
        saturation = (saturation / 2) | 0;
    }

    if (lightness > 217) {
        saturation = (saturation / 2) | 0;
    }

    if (lightness > 243) {
        saturation = (saturation / 2) | 0;
    }

    return ((saturation / 32) << 7) + ((hue / 4) << 10) + ((lightness / 2) | 0);
}

export function mixHsl(hslA: number, hslB: number): number {
    if (hslA === INVALID_HSL_COLOR || hslB === INVALID_HSL_COLOR) {
        return INVALID_HSL_COLOR;
    }
    if (hslA === -1) {
        return hslB;
    } else if (hslB === -1) {
        return hslA;
    } else {
        let hue = (hslA >> 10) & 0x3f;
        let saturation = (hslA >> 7) & 0x7;
        let lightness = hslA & 0x7f;

        let hueB = (hslB >> 10) & 0x3f;
        let saturationB = (hslB >> 7) & 0x7;
        let lightnessB = hslB & 0x7f;

        hue += hueB;
        saturation += saturationB;
        lightness += lightnessB;

        hue >>= 1;
        saturation >>= 1;
        lightness >>= 1;

        return (hue << 10) + (saturation << 7) + lightness;
    }
}

export function rgbToHsl(rgb: number): number {
    const r = ((rgb >> 16) & 255) / 256.0;
    const g = ((rgb >> 8) & 255) / 256.0;
    const b = (rgb & 255) / 256.0;

    let minRgb = r;
    if (g < r) {
        minRgb = g;
    }
    if (b < minRgb) {
        minRgb = b;
    }

    let maxRgb = r;
    if (g > r) {
        maxRgb = g;
    }
    if (b > maxRgb) {
        maxRgb = b;
    }

    let hueTemp = 0.0;
    let sat = 0.0;
    const light = (minRgb + maxRgb) / 2.0;
    if (minRgb !== maxRgb) {
        if (light < 0.5) {
            sat = (maxRgb - minRgb) / (minRgb + maxRgb);
        }

        if (light >= 0.5) {
            sat = (maxRgb - minRgb) / (2.0 - maxRgb - minRgb);
        }

        if (maxRgb === r) {
            hueTemp = (g - b) / (maxRgb - minRgb);
        } else if (maxRgb === g) {
            hueTemp = 2.0 + (b - r) / (maxRgb - minRgb);
        } else if (maxRgb === b) {
            hueTemp = 4.0 + (r - g) / (maxRgb - minRgb);
        }
    }

    hueTemp /= 6.0;

    const hue = (hueTemp * 256.0) | 0;
    let saturation = (sat * 256.0) | 0;
    let lightness = (light * 256.0) | 0;
    if (saturation < 0) {
        saturation = 0;
    } else if (saturation > 255) {
        saturation = 255;
    }

    if (lightness < 0) {
        lightness = 0;
    } else if (lightness > 255) {
        lightness = 255;
    }

    return packHsl(hue, saturation, lightness);
}

export function blendLight(hsl: number, lightness: number): number {
    lightness = ((hsl & 127) * lightness) >> 7;
    if (lightness < 2) {
        lightness = 2;
    } else if (lightness > 126) {
        lightness = 126;
    }

    return (hsl & 0xff80) + lightness;
}

export function adjustUnderlayLight(hsl: number, light: number) {
    if (hsl === -1) {
        return INVALID_HSL_COLOR;
    } else {
        light = ((hsl & 127) * light) >> 7;
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return (hsl & 0xff80) + light;
    }
}

export function adjustOverlayLight(hsl: number, light: number) {
    if (hsl === -2) {
        return INVALID_HSL_COLOR;
    } else if (hsl === -1) {
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return light;
    } else {
        light = ((hsl & 127) * light) >> 7;
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return (hsl & 0xff80) + light;
    }
}

// RGB15 (15-bit RGB, 5 bits per channel) to packed HSL conversion
// Used for minimap rendering from 15-bit color format
export function rgb15ToHsl(rgb15: number): number {
    const r = ((rgb15 >> 10) & 31) / 31.0;
    const g = ((rgb15 >> 5) & 31) / 31.0;
    const b = (rgb15 & 31) / 31.0;

    let minRgb = r;
    if (g < r) {
        minRgb = g;
    }
    if (b < minRgb) {
        minRgb = b;
    }

    let maxRgb = r;
    if (g > r) {
        maxRgb = g;
    }
    if (b > maxRgb) {
        maxRgb = b;
    }

    let hueTemp = 0.0;
    let sat = 0.0;
    const light = (minRgb + maxRgb) / 2.0;

    if (minRgb !== maxRgb) {
        if (light < 0.5) {
            sat = (maxRgb - minRgb) / (minRgb + maxRgb);
        }
        if (light >= 0.5) {
            sat = (maxRgb - minRgb) / (2.0 - maxRgb - minRgb);
        }

        if (r === maxRgb) {
            hueTemp = (g - b) / (maxRgb - minRgb);
        } else if (maxRgb === g) {
            hueTemp = 2.0 + (b - r) / (maxRgb - minRgb);
        } else if (b === maxRgb) {
            hueTemp = 4.0 + (r - g) / (maxRgb - minRgb);
        }
    }

    let hue = (((hueTemp * 256.0) / 6.0) | 0) & 255;
    let saturation = sat * 256.0;

    if (saturation < 0.0) {
        saturation = 0.0;
    } else if (saturation > 255.0) {
        saturation = 255.0;
    }

    // OSRS saturation reduction for high lightness values
    if (light > 0.7) {
        saturation = Math.floor(saturation / 2.0);
    }
    if (light > 0.75) {
        saturation = Math.floor(saturation / 2.0);
    }
    if (light > 0.85) {
        saturation = Math.floor(saturation / 2.0);
    }
    if (light > 0.95) {
        saturation = Math.floor(saturation / 2.0);
    }

    let lightness = light;
    if (lightness > 0.995) {
        lightness = 0.995;
    }

    const packedHueSat = ((hue / 4) | 0) * 8 + ((saturation / 32.0) | 0);
    return ((lightness * 128.0) | 0) + (packedHueSat << 7);
}

// Pre-computed RGB15 to HSL lookup table (32768 entries for 15-bit RGB)
export const RGB15_TO_HSL_MAP = buildRgb15ToHslMap();

function buildRgb15ToHslMap(): Int32Array {
    const map = new Int32Array(32768);
    for (let i = 0; i < 32768; i++) {
        map[i] = rgb15ToHsl(i);
    }
    return map;
}

// Clamp lightness to valid range (2-126) for model rendering
export function clampLightness(lightness: number): number {
    if (lightness < 2) {
        lightness = 2;
    } else if (lightness > 126) {
        lightness = 126;
    }
    return lightness | 0;
}

// Floor type HSL calculation result
export interface FloorHslResult {
    hue: number;
    saturation: number;
    lightness: number;
    hueMultiplier: number;
}

// Calculate HSL values for floor types (underlay/overlay)
// This is a specialized calculation that includes hueMultiplier for floor blending
export function calculateFloorHsl(rgb: number): FloorHslResult {
    const r = ((rgb >> 16) & 255) / 256.0;
    const g = ((rgb >> 8) & 255) / 256.0;
    const b = (rgb & 255) / 256.0;

    let minRgb = r;
    if (g < minRgb) {
        minRgb = g;
    }
    if (b < minRgb) {
        minRgb = b;
    }

    let maxRgb = r;
    if (g > maxRgb) {
        maxRgb = g;
    }
    if (b > maxRgb) {
        maxRgb = b;
    }

    let hueTemp = 0.0;
    let sat = 0.0;
    const light = (maxRgb + minRgb) / 2.0;

    if (minRgb !== maxRgb) {
        if (light < 0.5) {
            sat = (maxRgb - minRgb) / (maxRgb + minRgb);
        }
        if (light >= 0.5) {
            sat = (maxRgb - minRgb) / (2.0 - maxRgb - minRgb);
        }

        if (maxRgb === r) {
            hueTemp = (g - b) / (maxRgb - minRgb);
        } else if (maxRgb === g) {
            hueTemp = 2.0 + (b - r) / (maxRgb - minRgb);
        } else if (maxRgb === b) {
            hueTemp = 4.0 + (r - g) / (maxRgb - minRgb);
        }
    }

    hueTemp /= 6.0;

    let saturation = (sat * 256.0) | 0;
    let lightness = (light * 256.0) | 0;

    if (saturation < 0) {
        saturation = 0;
    } else if (saturation > 255) {
        saturation = 255;
    }

    if (lightness < 0) {
        lightness = 0;
    } else if (lightness > 255) {
        lightness = 255;
    }

    let hueMultiplier: number;
    if (light > 0.5) {
        hueMultiplier = (512.0 * (sat * (1.0 - light))) | 0;
    } else {
        hueMultiplier = (512.0 * (sat * light)) | 0;
    }

    if (hueMultiplier < 1) {
        hueMultiplier = 1;
    }

    const hue = (hueMultiplier * hueTemp) | 0;

    return { hue, saturation, lightness, hueMultiplier };
}

// Direct HSL to RGB conversion without brightness (for specific use cases)
export function hslToRgb(hsl: number): number {
    const hue = unpackHue(hsl) / 64.0 + HUE_OFFSET;
    const saturation = unpackSaturation(hsl) / 8.0 + SATURATION_OFFSET;
    const luminance = unpackLuminance(hsl) / 128.0;

    let r = luminance;
    let g = luminance;
    let b = luminance;

    if (saturation !== 0.0) {
        let q: number;
        if (luminance < 0.5) {
            q = luminance * (1.0 + saturation);
        } else {
            q = luminance + saturation - luminance * saturation;
        }

        const p = 2.0 * luminance - q;
        let hR = hue + 0.3333333333333333;
        if (hR > 1.0) {
            hR--;
        }

        let hB = hue - 0.3333333333333333;
        if (hB < 0.0) {
            hB++;
        }

        if (6.0 * hR < 1.0) {
            r = p + (q - p) * 6.0 * hR;
        } else if (2.0 * hR < 1.0) {
            r = q;
        } else if (3.0 * hR < 2.0) {
            r = p + (q - p) * (0.6666666666666666 - hR) * 6.0;
        } else {
            r = p;
        }

        if (6.0 * hue < 1.0) {
            g = p + (q - p) * 6.0 * hue;
        } else if (2.0 * hue < 1.0) {
            g = q;
        } else if (3.0 * hue < 2.0) {
            g = p + (q - p) * (0.6666666666666666 - hue) * 6.0;
        } else {
            g = p;
        }

        if (6.0 * hB < 1.0) {
            b = p + (q - p) * 6.0 * hB;
        } else if (2.0 * hB < 1.0) {
            b = q;
        } else if (3.0 * hB < 2.0) {
            b = p + (q - p) * (0.6666666666666666 - hB) * 6.0;
        } else {
            b = p;
        }
    }

    const ri = ((r * 256.0) | 0) & 255;
    const gi = ((g * 256.0) | 0) & 255;
    const bi = ((b * 256.0) | 0) & 255;
    let rgb = (ri << 16) | (gi << 8) | bi;

    if (rgb === 0) {
        rgb = 1;
    }

    return rgb;
}
