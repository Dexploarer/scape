import { TextureLoader } from "../../../rs/texture/TextureLoader";

export type TextureLayout = {
    idToLayer: Map<number, number>;
    frameCounts: Map<number, number>;
    layerCount: number;
};

/**
    Compute texture array layout that keeps animation frames contiguous per texture.
    Layer 0 is reserved for the white fallback texture.
*/
export function computeTextureLayout(
    textureIds: number[],
    textureLoader: TextureLoader,
    maxLayers: number,
): TextureLayout {
    const idToLayer = new Map<number, number>();
    const frameCounts = new Map<number, number>();
    let cursor = 1; // reserve layer 0 for the default white texel

    for (const textureId of textureIds) {
        let frames = Math.max(1, textureLoader.getFrameCount(textureId));
        const remaining = maxLayers - cursor;

        if (remaining <= 0) {
            // Out of space: fall back to layer 0 (white) but keep bookkeeping.
            idToLayer.set(textureId, 0);
            frameCounts.set(textureId, 1);
            continue;
        }

        if (frames > remaining) {
            frames = remaining;
            console.warn(
                `computeTextureLayout: trimming texture ${textureId} frames to ${frames} (capacity ${maxLayers})`,
            );
        }

        idToLayer.set(textureId, cursor);
        frameCounts.set(textureId, frames);
        cursor += frames;
    }

    return {
        idToLayer,
        frameCounts,
        layerCount: Math.max(cursor, 1),
    };
}
