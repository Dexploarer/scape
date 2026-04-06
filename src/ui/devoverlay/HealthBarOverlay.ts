import { vec3 } from "gl-matrix";
import {
    DrawCall,
    App as PicoApp,
    PicoGL,
    Program,
    Texture,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import type { CacheIndex } from "../../rs/cache/CacheIndex";
import type { CacheInfo } from "../../rs/cache/CacheInfo";
import type { CacheSystem } from "../../rs/cache/CacheSystem";
import { ConfigType } from "../../rs/cache/ConfigType";
import { IndexType } from "../../rs/cache/IndexType";
import { HealthBarDefinition } from "../../rs/config/healthbar/HealthBarDefinition";
import { ArchiveHealthBarDefinitionLoader } from "../../rs/config/healthbar/HealthBarDefinitionLoader";
import { IndexedSprite } from "../../rs/sprite/IndexedSprite";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";
import {
    HealthBarEntry,
    Overlay,
    OverlayInitArgs,
    OverlayUpdateArgs,
    RenderPhase,
} from "./Overlay";

export interface HealthBarContext {
    getCacheSystem: () => CacheSystem;
    getLoadedCacheInfo: () => CacheInfo | undefined;
}

interface SpriteTexture {
    tex: Texture;
    w: number;
    h: number;
}

/**
 * Renders RuneScape-style health bars in screen space using the same billboard shader
 * as the hitsplat overlay. The bar is anchored to a world position and rendered in
 * two passes (background + fill), honouring definition widths/padding when available.
 */
export class HealthBarOverlay implements Overlay {
    constructor(
        private readonly program: Program,
        private readonly ctx: HealthBarContext,
    ) {}

    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;

    private positions?: VertexBuffer;
    private uvs?: VertexBuffer;
    private array?: VertexArray;
    private drawCall?: DrawCall;

    private spriteIndex?: CacheIndex;
    private defs?: Map<number, HealthBarDefinition>;
    private defaultDefId: number = 0;

    private spriteTextures: Map<number, SpriteTexture> = new Map();
    private fallbackTexture?: SpriteTexture;

    private screenSize: Float32Array = new Float32Array(2);
    private tint: Float32Array = new Float32Array([1, 1, 1, 1]);
    private centerWorld: vec3 = vec3.create();
    private quadVerts: Float32Array = new Float32Array(12);
    private quadUvs: Float32Array = new Float32Array([0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]);
    // PERF: Cached Map to avoid allocation per frame
    private stackOffsets: Map<number, number> = new Map();

    private lastArgs?: OverlayUpdateArgs;
    private entries: HealthBarEntry[] = [];

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        this.positions = this.app.createVertexBuffer(PicoGL.FLOAT, 2, new Float32Array(12));
        this.uvs = this.app.createVertexBuffer(PicoGL.FLOAT, 2, this.quadUvs);
        this.array = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.positions)
            .vertexAttributeBuffer(1, this.uvs);
        this.drawCall = this.app
            .createDrawCall(this.program, this.array)
            .uniformBlock("SceneUniforms", this.sceneUniforms)
            .uniform("u_screenSize", this.screenSize)
            .uniform("u_tint", this.tint)
            .primitive(PicoGL.TRIANGLES);

        this.destroyTextures();
        this.initAssetsFromCache();
    }

    private destroyTextures(): void {
        for (const sprite of this.spriteTextures.values()) {
            try {
                sprite.tex.delete?.();
            } catch {}
        }
        this.spriteTextures.clear();
        if (this.fallbackTexture) {
            try {
                this.fallbackTexture.tex.delete?.();
            } catch {}
            this.fallbackTexture = undefined;
        }
    }

    dispose(): void {
        this.destroyTextures();
        try {
            this.positions?.delete?.();
            this.uvs?.delete?.();
            this.array?.delete?.();
        } catch {}
        this.positions = undefined;
        this.uvs = undefined;
        this.array = undefined;
        this.drawCall = undefined;
    }

    private initAssetsFromCache(): void {
        try {
            const cacheSystem = this.ctx.getCacheSystem();
            if (!cacheSystem) return; // Cache not loaded yet
            const configIndex = cacheSystem.getIndex(IndexType.DAT2.configs);
            if (!configIndex.archiveExists(ConfigType.OSRS.healthBar)) {
                return;
            }
            const cacheInfo = this.ctx.getLoadedCacheInfo?.();
            if (!cacheInfo) return;
            const archive = configIndex.getArchive(ConfigType.OSRS.healthBar);
            const loader = new ArchiveHealthBarDefinitionLoader(cacheInfo, archive);
            const ids = Array.from(archive.fileIds) as number[];
            ids.sort((a, b) => a - b);
            const map = new Map<number, HealthBarDefinition>();
            for (const id of ids) {
                try {
                    const def = loader.load(id);
                    if (def) map.set(id, def);
                } catch (err) {
                    console.warn("[HealthBarOverlay] failed to load definition", id, err);
                }
            }
            if (map.size > 0) {
                this.defs = map;
                this.defaultDefId = ids[0] ?? 0;
            }
        } catch (err) {
            console.warn("[HealthBarOverlay] initAssetsFromCache error", err);
        }

        try {
            const cacheSystem = this.ctx.getCacheSystem();
            this.spriteIndex = cacheSystem.getIndex(IndexType.DAT2.sprites);
        } catch {
            this.spriteIndex = undefined;
        }
    }

    private ensureFallbackTexture(): SpriteTexture {
        if (this.fallbackTexture) return this.fallbackTexture;
        const tex = this.app.createTexture2D(new Uint8Array([255, 255, 255, 255]), 1, 1, {
            internalFormat: PicoGL.RGBA8,
            type: PicoGL.UNSIGNED_BYTE,
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
            wrapS: PicoGL.CLAMP_TO_EDGE,
            wrapT: PicoGL.CLAMP_TO_EDGE,
        });
        const sprite = { tex, w: 1, h: 1 };
        this.fallbackTexture = sprite;
        return sprite;
    }

    private textureFromSprite(id: number | undefined): SpriteTexture | undefined {
        if (id == null || id < 0) return undefined;
        const cached = this.spriteTextures.get(id);
        if (cached) return cached;
        const spriteIndex = this.spriteIndex;
        if (!spriteIndex) return undefined;
        try {
            const indexed = SpriteLoader.loadIntoIndexedSprite(spriteIndex, id);
            if (!indexed) return undefined;
            const sprite = this.createTextureFromIndexedSprite(indexed);
            this.spriteTextures.set(id, sprite);
            return sprite;
        } catch (err) {
            console.warn("[HealthBarOverlay] failed to load sprite", id, err);
            return undefined;
        }
    }

    private createTextureFromIndexedSprite(spr: IndexedSprite): SpriteTexture {
        const width = Math.max(1, spr.subWidth | 0);
        const height = Math.max(1, spr.subHeight | 0);
        const pixels = new Uint8Array(width * height * 4);
        const palette = spr.palette ?? new Int32Array([0xff_ff_ff_ff]);
        const src = spr.pixels ?? new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const idx = src[i] & 0xff;
            const color = palette[idx] ?? 0;
            const r = (color >> 16) & 0xff;
            const g = (color >> 8) & 0xff;
            const b = color & 0xff;
            const a = color === 0 ? 0 : 0xff;
            const di = i * 4;
            pixels[di] = r;
            pixels[di + 1] = g;
            pixels[di + 2] = b;
            pixels[di + 3] = a;
        }
        const tex = this.app.createTexture2D(pixels, width, height, {
            internalFormat: PicoGL.RGBA8,
            type: PicoGL.UNSIGNED_BYTE,
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
            wrapS: PicoGL.CLAMP_TO_EDGE,
            wrapT: PicoGL.CLAMP_TO_EDGE,
        });
        return { tex, w: width, h: height };
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
        // OverlayManager updates overlays twice per frame. Preserve the scene-pass
        // health bar payload when the later post-present update omits it.
        if (Object.prototype.hasOwnProperty.call(args.state, "healthBars")) {
            this.entries = Array.isArray(args.state.healthBars) ? args.state.healthBars : [];
        }
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.drawCall || !this.positions || !this.uvs) return;

        const args = this.lastArgs;
        if (!args) return;
        const entries = this.entries;
        if (entries.length === 0) return;

        this.screenSize[0] = this.app.width;
        this.screenSize[1] = this.app.height;
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);

        const helpers = args.helpers;
        const center = this.centerWorld;
        // PERF: Reuse cached Map, clear instead of allocating new
        const stackOffsets = this.stackOffsets;
        stackOffsets.clear();

        // Track which keys are active this frame for cleanup
        for (const entry of entries) {
            const ratio = Math.min(1, Math.max(0, entry.ratio ?? 0));
            const alpha = Math.min(1, Math.max(0, entry.alpha ?? 1));
            if (alpha <= 0) continue;

            const plane = entry.plane | 0;
            // Use the actor's actual plane directly for height calculation.
            // getEffectivePlaneForTile would incorrectly promote plane 0 to 1 under bridges,
            // causing health bars to render at the wrong height for NPCs under bridges.
            const height = helpers.getTileHeightAtPlane(entry.worldX, entry.worldZ, plane);
            const headOffset = entry.heightOffsetTiles ?? 0.5;
            center[0] = entry.worldX;
            center[1] = height - headOffset;
            center[2] = entry.worldZ;

            const definition = this.resolveDefinition(entry.defId);
            const back = this.textureFromSprite(definition?.backSpriteId);
            const front = this.textureFromSprite(definition?.frontSpriteId);
            const fallback = this.ensureFallbackTexture();
            const hasBackSprite = !!back;
            const hasFrontSprite = !!front;
            const hasBothSprites = hasBackSprite && hasFrontSprite;
            const fallbackWidth = Math.max(36, fallback.w | 0);

            const padRaw = Math.max(0, definition?.widthPadding ?? 0) | 0;
            const frontW = hasFrontSprite ? Math.max(1, front!.w | 0) : 0;
            const pad = hasBothSprites && padRaw * 2 < frontW ? padRaw : 0;
            const totalWidth = Math.max(
                1,
                hasBothSprites
                    ? frontW
                    : (definition?.width ?? 0) > 0
                    ? definition!.width | 0
                    : fallbackWidth,
            );
            const heightPx = Math.max(front?.h ?? 0, back?.h ?? 0, 6) | 0;
            const backSprite = (back ?? fallback) as any;
            const barHeight = (hasBackSprite ? backSprite.h : heightPx) | 0;
            const groupKey = typeof entry.groupKey === "number" ? entry.groupKey | 0 : undefined;
            const stackOffset = groupKey !== undefined ? stackOffsets.get(groupKey) ?? 0 : 0;
            const y = -(((barHeight + 2) | 0) + (stackOffset | 0));
            const x = -Math.floor(totalWidth / 2);

            const backWidth = hasBackSprite ? backSprite.w : totalWidth;
            const backHeight = hasBackSprite ? backSprite.h : heightPx;
            this.writeQuad(x, y, backWidth, backHeight);
            this.resetFullUvs();
            if (!hasBackSprite) {
                this.tint[0] = 0.12;
                this.tint[1] = 0.12;
                this.tint[2] = 0.12;
            } else {
                this.tint[0] = this.tint[1] = this.tint[2] = 1.0;
            }
            this.tint[3] = alpha;
            this.positions.data(this.quadVerts);
            this.uvs.data(this.quadUvs);
            this.drawCall
                .uniform("u_screenSize", this.screenSize)
                .uniform("u_centerWorld", center)
                .uniform("u_tint", this.tint)
                .texture("u_sprite", backSprite.tex)
                .draw();

            const frontSprite = front ?? fallback;
            if (ratio > 0) {
                const spriteWidth = Math.max(1, hasBothSprites ? frontSprite.w : totalWidth);
                const usable = Math.max(0, spriteWidth - pad * 2);
                let fillPixels = Math.floor(usable * ratio);
                // ensure at least 1px when the target is non-zero.
                if (fillPixels < 1) fillPixels = 1;
                let widthClamped = fillPixels;
                if (hasBothSprites) {
                    widthClamped += fillPixels >= usable ? pad * 2 : pad;
                }
                const fillX = x;
                const fillY = y;
                this.writeQuad(fillX, fillY, widthClamped, heightPx || frontSprite.h);
                const uScale = widthClamped / spriteWidth;
                this.updateFillUvs(uScale);
                if (!hasFrontSprite) {
                    const colorHigh = ratio > 0.6;
                    const colorMid = ratio > 0.3;
                    if (colorHigh) {
                        this.tint[0] = 0.1;
                        this.tint[1] = 0.68;
                        this.tint[2] = 0.18;
                    } else if (colorMid) {
                        this.tint[0] = 0.85;
                        this.tint[1] = 0.52;
                        this.tint[2] = 0.12;
                    } else {
                        this.tint[0] = 0.78;
                        this.tint[1] = 0.12;
                        this.tint[2] = 0.12;
                    }
                } else {
                    this.tint[0] = this.tint[1] = this.tint[2] = 1.0;
                }
                this.tint[3] = alpha;
                this.positions.data(this.quadVerts);
                this.uvs.data(this.quadUvs);
                this.drawCall
                    .uniform("u_screenSize", this.screenSize)
                    .uniform("u_centerWorld", center)
                    .uniform("u_tint", this.tint)
                    .texture("u_sprite", frontSprite.tex)
                    .draw();
            }
            this.resetFullUvs();

            if (groupKey !== undefined) {
                stackOffsets.set(groupKey, (stackOffset + barHeight + 2) | 0);
            }
        }
    }

    private writeQuad(x: number, y: number, w: number, h: number): void {
        const verts = this.quadVerts;
        verts[0] = x;
        verts[1] = y;
        verts[2] = x;
        verts[3] = y + h;
        verts[4] = x + w;
        verts[5] = y + h;
        verts[6] = x;
        verts[7] = y;
        verts[8] = x + w;
        verts[9] = y + h;
        verts[10] = x + w;
        verts[11] = y;
    }

    private resetFullUvs(): void {
        const uvs = this.quadUvs;
        uvs[0] = 0;
        uvs[1] = 0;
        uvs[2] = 0;
        uvs[3] = 1;
        uvs[4] = 1;
        uvs[5] = 1;
        uvs[6] = 0;
        uvs[7] = 0;
        uvs[8] = 1;
        uvs[9] = 1;
        uvs[10] = 1;
        uvs[11] = 0;
    }

    private updateFillUvs(uMax: number): void {
        const u = Math.min(1, Math.max(0, uMax));
        const uvs = this.quadUvs;
        uvs[0] = 0;
        uvs[1] = 0;
        uvs[2] = 0;
        uvs[3] = 1;
        uvs[4] = u;
        uvs[5] = 1;
        uvs[6] = 0;
        uvs[7] = 0;
        uvs[8] = u;
        uvs[9] = 1;
        uvs[10] = u;
        uvs[11] = 0;
    }

    private resolveDefinition(id?: number): HealthBarDefinition | undefined {
        const defs = this.defs;
        if (!defs || defs.size === 0) return undefined;
        const targetId = typeof id === "number" && defs.has(id) ? id : this.defaultDefId;
        return defs.get(targetId);
    }

    getDefinition(id?: number): HealthBarDefinition | undefined {
        return this.resolveDefinition(id);
    }
}
