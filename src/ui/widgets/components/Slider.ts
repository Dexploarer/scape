import type { GLRenderer } from "../../gl/renderer";

export type Texture = { tex: WebGLTexture; w: number; h: number };
export type TextureProvider = {
    getByNameToken(token: string): Texture | undefined;
    getSpriteById?(id: number): Texture | undefined;
};

export interface SliderSpriteNames {
    leftCap?: string;
    leftNotch?: string;
    middle?: string;
    rightNotch?: string;
    rightCap?: string;
    bobble?: string;
    bobbleDisabled?: string;
    bobbleMuted?: string;
    tickMark?: string;
}

// Sprite mappings based on OSRS CS2 scripts (settings_create_slider.cs2):
// Track: 0=left cap, 1=left notch, 3=middle, 4=right notch, 5=right cap
// Tick marks: 11
// Bobble: 6=normal, 7=disabled, 12=muted (from settings_slider_choose_bobble)
const DEFAULT_SPRITES: SliderSpriteNames = {
    leftCap: "settings_slider,0", // left cap
    leftNotch: "settings_slider,1", // left notch
    middle: "settings_slider,3", // middle segment
    rightNotch: "settings_slider,4", // right notch
    rightCap: "settings_slider,5", // right cap
    tickMark: "settings_slider,11", // tick mark
    bobble: "settings_slider,6", // normal/enabled bobble
    bobbleDisabled: "settings_slider,7", // disabled bobble
    bobbleMuted: "settings_slider,12", // muted bobble
};

export interface SliderRects {
    trackRect: { x: number; y: number; w: number; h: number };
    bobbleRect: { x: number; y: number; w: number; h: number };
    segments: Array<{ x: number; y: number; w: number; h: number; value: number }>;
    maxValue: number;
}

/**
 * Computes layout rectangles for a horizontal slider.
 * OSRS sliders are typically 19 segments * 16px = 304px wide.
 */
export function computeSlider(
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
    maxValue: number,
    segmentCount: number = 19,
): SliderRects {
    const segW = Math.floor(width / segmentCount);
    const trackW = segW * segmentCount;
    const trackX = x + Math.floor((width - trackW) / 2);

    // Bobble position - first and last segments are end caps
    const usableSegments = segmentCount - 2; // Exclude end caps
    const bobbleTrackStart = trackX + segW; // After left cap
    const bobbleTrackW = trackW - segW * 2; // Exclude both caps

    // Calculate bobble position based on value
    const bobbleX =
        value <= 0
            ? bobbleTrackStart
            : value >= maxValue
            ? bobbleTrackStart + bobbleTrackW - segW
            : bobbleTrackStart + Math.floor((value / maxValue) * (bobbleTrackW - segW));

    // Build segment rects for click detection
    const segments: SliderRects["segments"] = [];
    for (let i = 0; i <= maxValue; i++) {
        const segX =
            i === 0
                ? bobbleTrackStart
                : i === maxValue
                ? bobbleTrackStart + bobbleTrackW - segW
                : bobbleTrackStart + Math.floor((i / maxValue) * (bobbleTrackW - segW));
        const nextX =
            i === maxValue
                ? bobbleTrackStart + bobbleTrackW
                : i + 1 === maxValue
                ? bobbleTrackStart + bobbleTrackW - segW
                : bobbleTrackStart + Math.floor(((i + 1) / maxValue) * (bobbleTrackW - segW));
        segments.push({
            x: segX,
            y,
            w: Math.max(1, nextX - segX),
            h: height,
            value: i,
        });
    }

    return {
        trackRect: { x: trackX, y, w: trackW, h: height },
        bobbleRect: { x: bobbleX, y, w: segW, h: height },
        segments,
        maxValue,
    };
}

/**
 * Draws a horizontal slider using OSRS sprite conventions.
 * Uses native 16px sprites - track is always 9 segments = 144px.
 * The bobble area is 112px (7 inner segments).
 */
export function drawSlider(
    glr: GLRenderer,
    tex: TextureProvider,
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
    maxValue: number,
    options?: {
        enabled?: boolean;
        muted?: boolean;
        sprites?: SliderSpriteNames;
        showTickMarks?: boolean;
    },
): SliderRects {
    const sprites = { ...DEFAULT_SPRITES, ...options?.sprites };
    const enabled = options?.enabled !== false;
    const muted = options?.muted === true;

    // OSRS uses exactly 9 segments at 16px = 144px total
    const SEG_SIZE = 16;
    const SEGMENT_COUNT = 9;
    const TRACK_W = SEG_SIZE * SEGMENT_COUNT; // 144px

    // Center track in available width
    const trackX = x + Math.floor((width - TRACK_W) / 2);

    const resolve = (token?: string) => (token ? tex.getByNameToken(token) : undefined);

    // Draw track segments with exact OSRS pattern from CS2 scripts:
    // 0=left cap, 1=left notch, 3=middle (x5), 4=right notch, 5=right cap
    const trackPattern = [
        "settings_slider,0", // position 0 - left cap
        "settings_slider,1", // position 1 - left notch
        "settings_slider,3", // position 2 - middle
        "settings_slider,3", // position 3 - middle
        "settings_slider,3", // position 4 - middle
        "settings_slider,3", // position 5 - middle
        "settings_slider,3", // position 6 - middle
        "settings_slider,4", // position 7 - right notch
        "settings_slider,5", // position 8 - right cap
    ];

    let curX = trackX;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const spriteToken = trackPattern[i];
        const sprite = resolve(spriteToken);
        if (sprite) {
            glr.drawTexture(sprite, curX, y, SEG_SIZE, SEG_SIZE, 1, 1);
        } else {
            // Fallback: draw a gray rectangle
            glr.drawRect(curX, y, SEG_SIZE, SEG_SIZE, [0.25, 0.25, 0.25, 1]);
        }
        curX += SEG_SIZE;
    }

    // Bobble area: 112px (starts after first segment, ends before last)
    const bobbleAreaX = trackX + SEG_SIZE;
    const bobbleAreaW = TRACK_W - SEG_SIZE * 2; // 112px

    // Calculate bobble position within the 112px area
    // Bobble is 16px wide, so it can move in a 96px range (112 - 16)
    const bobbleRange = bobbleAreaW - SEG_SIZE;

    // Draw tick marks at all value positions (0 through maxValue)
    // These are drawn ON TOP of the track using settings_slider,11
    const tickSprite = resolve("settings_slider,11");
    if (tickSprite && maxValue > 0) {
        for (let tickVal = 0; tickVal <= maxValue; tickVal++) {
            const tickX = bobbleAreaX + Math.floor((tickVal / maxValue) * bobbleRange);
            glr.drawTexture(tickSprite, tickX, y, SEG_SIZE, SEG_SIZE, 1, 1);
        }
    }
    const bobbleX =
        value <= 0
            ? bobbleAreaX
            : value >= maxValue
            ? bobbleAreaX + bobbleRange
            : bobbleAreaX + Math.floor((value / maxValue) * bobbleRange);

    // Draw bobble/knob - from CS2 settings_slider_choose_bobble:
    // 6=normal, 7=disabled, 12=muted
    let bobbleSprite: Texture | undefined;
    if (muted) {
        bobbleSprite = resolve("settings_slider,12"); // muted bobble
    } else if (!enabled) {
        bobbleSprite = resolve("settings_slider,7"); // disabled bobble
    } else {
        bobbleSprite = resolve("settings_slider,6"); // normal/enabled bobble
    }

    if (bobbleSprite) {
        glr.drawTexture(bobbleSprite, bobbleX, y, SEG_SIZE, SEG_SIZE, 1, 1);
    } else {
        // Fallback: draw an orange rectangle for the bobble
        const color = muted ? [0.5, 0.5, 0.5, 1] : enabled ? [1, 0.6, 0.1, 1] : [0.6, 0.6, 0.6, 1];
        glr.drawRect(
            bobbleX + 2,
            y + 2,
            SEG_SIZE - 4,
            SEG_SIZE - 4,
            color as [number, number, number, number],
        );
    }

    // Build click segments for interaction
    const segments: SliderRects["segments"] = [];
    for (let i = 0; i <= maxValue; i++) {
        const segX = bobbleAreaX + Math.floor((i / maxValue) * bobbleRange);
        const nextX =
            i === maxValue
                ? bobbleAreaX + bobbleAreaW
                : bobbleAreaX + Math.floor(((i + 1) / maxValue) * bobbleRange);
        segments.push({
            x: segX,
            y,
            w: Math.max(1, nextX - segX),
            h: SEG_SIZE,
            value: i,
        });
    }

    return {
        trackRect: { x: trackX, y, w: TRACK_W, h: SEG_SIZE },
        bobbleRect: { x: bobbleX, y, w: SEG_SIZE, h: SEG_SIZE },
        segments,
        maxValue,
    };
}

/**
 * Helper to register slider click handlers
 */
export function registerSliderClicks(
    clicks: any,
    rects: SliderRects,
    id: string,
    label: string,
    onValueChange: (value: number) => void,
) {
    if (!clicks?.register) return;

    for (const seg of rects.segments) {
        clicks.register({
            id: `${id}.seg.${seg.value}`,
            rect: { x: seg.x, y: seg.y, w: seg.w, h: seg.h },
            hoverText: `${label}: ${seg.value}`,
            onClick: () => onValueChange(seg.value),
        });
    }
}

/**
 * Draws a complete slider with icon (like OSRS audio/display settings)
 * OSRS structure: 172x34px holder with 36x34 icon and 144x16 slider
 */
export function drawSliderWithIcon(
    glr: GLRenderer,
    tex: TextureProvider,
    clicks: any,
    x: number,
    y: number,
    width: number,
    iconSprite: string,
    value: number,
    maxValue: number,
    label: string,
    id: string,
    onValueChange: (value: number) => void,
    onIconClick?: () => void,
): SliderRects {
    // OSRS: track starts at x=28 from holder, holder is 172x34, track is 144x16
    const ICON_AREA_W = 28; // Icon area before slider track
    const HOLDER_H = 34;
    const SLIDER_H = 16;

    // Draw icon centered in icon area (no background box)
    const icon = tex.getByNameToken?.(iconSprite);
    if (icon) {
        const iconX = x + (ICON_AREA_W - Math.min(24, icon.w)) / 2;
        const iconY = y + (HOLDER_H - Math.min(24, icon.h)) / 2;
        glr.drawTexture(icon, iconX, iconY, Math.min(24, icon.w), Math.min(24, icon.h), 1, 1);
    }

    // Register icon click
    if (clicks?.register && onIconClick) {
        clicks.register({
            id: `${id}.icon`,
            rect: { x, y, w: ICON_AREA_W, h: HOLDER_H },
            hoverText: value > 0 ? `Mute ${label}` : `Unmute ${label}`,
            onClick: onIconClick,
        });
    }

    // Draw slider at x=28 offset, vertically centered (y=9 from holder top)
    const sliderX = x + ICON_AREA_W;
    const sliderY = y + (HOLDER_H - SLIDER_H) / 2; // = y + 9
    const sliderW = 144; // Fixed OSRS track width

    const muted = value === 0;
    const rects = drawSlider(glr, tex, sliderX, sliderY, sliderW, SLIDER_H, value, maxValue, {
        enabled: true,
        muted,
    });

    // Register slider clicks
    registerSliderClicks(clicks, rects, id, label, onValueChange);

    return rects;
}
