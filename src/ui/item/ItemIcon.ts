import { CacheIndex } from "../../rs/cache/CacheIndex";
import { IndexedSprite } from "../../rs/sprite/IndexedSprite";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";

/**
 * Try to resolve the inventory icon sprite for a given item id.
 * Attempts common name-token packs before falling back to raw numeric id.
 */
const packCache: WeakMap<CacheIndex, Map<string, IndexedSprite[]>> = new WeakMap();

function loadPackSprites(spriteIndex: CacheIndex, pack: string): IndexedSprite[] | undefined {
    let packs = packCache.get(spriteIndex);
    if (!packs) {
        packs = new Map();
        packCache.set(spriteIndex, packs);
    }
    if (packs.has(pack)) return packs.get(pack);
    try {
        const id = (spriteIndex as any).getArchiveId?.(pack);
        if (typeof id === "number" && id >= 0) {
            const arr = SpriteLoader.loadIntoIndexedSprites(spriteIndex, id);
            if (arr && arr.length) {
                packs.set(pack, arr);
                return arr;
            }
        }
    } catch {}
    packs.set(pack, []);
    return undefined;
}

export function resolveItemIconSprite(
    spriteIndex: CacheIndex,
    itemId: number,
): IndexedSprite | undefined {
    if (!(itemId >= 0)) return undefined;
    // 1) Try common named-token variants that directly point to a single-frame archive
    const tryTokens = [`inv,${itemId}`, `obj_icons,${itemId}`, `obj,${itemId}`, `item,${itemId}`];
    for (const tok of tryTokens) {
        try {
            const id = (spriteIndex as any).getArchiveId?.(tok);
            if (typeof id === "number" && id >= 0) {
                const spr = SpriteLoader.loadIntoIndexedSprite(spriteIndex, id);
                if (spr) return spr;
            }
        } catch {}
    }
    // 2) Try known packs where the frame index matches the item id
    const packs = ["inv", "obj_icons", "obj", "items", "item_icons"];
    for (const p of packs) {
        const arr = loadPackSprites(spriteIndex, p);
        if (arr && itemId < arr.length && arr[itemId]) return arr[itemId];
    }
    // 3) Fallback: attempt raw sprite id (often wrong for items, but harmless)
    try {
        const spr = SpriteLoader.loadIntoIndexedSprite(spriteIndex, itemId);
        if (spr) return spr;
    } catch {}
    return undefined;
}

/** Convert an IndexedSprite to an HTMLCanvasElement with premultiplied alpha off. */
export function spriteToCanvas(sprite: IndexedSprite): HTMLCanvasElement {
    try {
        sprite.normalize();
    } catch {}
    const w = sprite.width || sprite.subWidth;
    const h = sprite.height || sprite.subHeight;
    const cw = Math.max(1, w);
    const ch = Math.max(1, h);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", {
        willReadFrequently: true as any,
    }) as CanvasRenderingContext2D;
    const img = ctx.createImageData(cw, ch);
    const pal = sprite.palette;
    const px = sprite.pixels;
    const sw = sprite.subWidth;
    const sh = sprite.subHeight;
    const ox = sprite.xOffset | 0;
    const oy = sprite.yOffset | 0;
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const si = x + y * sw;
            const idx = px[si] & 0xff;
            if (idx === 0) continue;
            const dx = x + ox;
            const dy = y + oy;
            if (dx < 0 || dy < 0 || dx >= cw || dy >= ch) continue;
            const di = (dx + dy * cw) * 4;
            const rgb = pal[idx];
            img.data[di] = (rgb >> 16) & 0xff;
            img.data[di + 1] = (rgb >> 8) & 0xff;
            img.data[di + 2] = rgb & 0xff;
            img.data[di + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

/**
 * Resolve an item icon by id and return it as a canvas for easy consumption
 * by WebGL textures or DOM <img> via toDataURL().
 */
export function getItemIconCanvas(
    spriteIndex: CacheIndex,
    itemId: number,
): HTMLCanvasElement | undefined {
    const spr = resolveItemIconSprite(spriteIndex, itemId);
    return spr ? spriteToCanvas(spr) : undefined;
}
