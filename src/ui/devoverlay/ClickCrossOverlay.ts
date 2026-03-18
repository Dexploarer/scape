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

import { IndexType } from "../../rs/cache/IndexType";
import { IndexedSprite } from "../../rs/sprite/IndexedSprite";
import { SpriteLoader } from "../../rs/sprite/SpriteLoader";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

export interface ClickCrossContext {
    getCacheSystem: () => any;
}

type CrossAnim = {
    x: number; // tile x
    y: number; // tile y
    screenX: number; // canvas coordinates
    screenY: number; // canvas coordinates
    basePlane: number; // base plane at time of click
    startTime: number; // ms timestamp
    frameOffset: number; // 0 = yellow(0..3), 4 = red(4..7)
};

export class ClickCrossOverlay implements Overlay {
    constructor(
        private program: Program,
        private ctx: ClickCrossContext,
    ) {}

    // GPU state
    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;
    private positions?: VertexBuffer; // vec2 pixel offsets
    private uvs?: VertexBuffer; // vec2
    private array?: VertexArray;
    private drawCall?: DrawCall;

    private screenSize = new Float32Array(2);
    private centerWorld = vec3.create();
    private tint = new Float32Array([1, 1, 1, 1]);
    // PERF: Cached verts array to avoid allocation every draw
    private cachedVerts = new Float32Array(12);

    // Assets: 4-frame cross animation (sprite id 299 frames 0..3)
    private frames?: Array<{ tex: Texture; w: number; h: number }>;

    // Runtime
    private lastArgs?: OverlayUpdateArgs;
    private queue: CrossAnim[] = [];

    // Controls
    frameDurationMs: number = 100; // 4 frames * 100ms = 400ms total
    scale: number = 1.0;
    spriteId: number = 299; // Cross sprite base id
    // Frame group offsets within sprite sheet
    private yellowOffset: number = 0; // frames 0..3
    private redOffset: number = 4; // frames 4..7

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // Buffers and pipeline
        this.positions = this.app.createVertexBuffer(PicoGL.FLOAT, 2, new Float32Array(6 * 2));
        const uv = new Float32Array([0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]);
        this.uvs = this.app.createVertexBuffer(PicoGL.FLOAT, 2, uv);
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

        // Load sprite frames from cache
        this.destroyFrames();
        this.initFramesFromCache();
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
        // Cull expired animations
        // PERF: Filter in-place to avoid allocating a new array each frame
        const now = args.time | 0;
        const animLen = this.frameDurationMs * 4;
        let writeIdx = 0;
        for (let i = 0; i < this.queue.length; i++) {
            if (now - this.queue[i].startTime < animLen) {
                this.queue[writeIdx++] = this.queue[i];
            }
        }
        this.queue.length = writeIdx;
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.ToFrameTexture) return;
        if (!this.drawCall || !this.positions || !this.frames || this.frames.length === 0) return;
        const args = this.lastArgs;
        if (!args) return;

        // Render state
        this.screenSize[0] = this.app.width;
        this.screenSize[1] = this.app.height;
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);

        const now = args.time | 0;
        const fdur = Math.max(1, this.frameDurationMs | 0);

        for (const anim of this.queue) {
            const elapsed = Math.max(0, now - (anim.startTime | 0));
            let baseIndex = Math.floor(elapsed / fdur) | 0;
            if (baseIndex < 0 || baseIndex > 3) continue;
            const index = (anim.frameOffset | 0) + baseIndex;
            const f = this.frames[index];
            if (!f) continue;

            // Resolve world anchor (tile center at effective surface plane)
            const effPlane = args.helpers.getEffectivePlaneForTile(
                anim.x | 0,
                anim.y | 0,
                anim.basePlane | 0,
            );
            const h = args.helpers.getTileHeightAtPlane(anim.x + 0.5, anim.y + 0.5, effPlane);
            this.centerWorld[0] = anim.x + 0.5;
            this.centerWorld[1] = h - 0.05; // slightly above ground
            this.centerWorld[2] = anim.y + 0.5;

            const scale = this.scale || 1.0;
            const w = (f.w * scale) | 0;
            const hq = (f.h * scale) | 0;
            // Align cross center to the original click screen position
            let offX = 0;
            let offY = 0;
            try {
                const scr = args.helpers.worldToScreen?.(
                    this.centerWorld[0],
                    this.centerWorld[1],
                    this.centerWorld[2],
                ) as any;
                if (scr && typeof scr[0] === "number" && typeof scr[1] === "number") {
                    offX = (anim.screenX | 0) - (scr[0] | 0);
                    offY = (anim.screenY | 0) - (scr[1] | 0);
                }
            } catch {}
            const x = (-(w >> 1) + offX) | 0;
            const y = (-(hq >> 1) + offY) | 0;
            // PERF: Reuse cached verts array instead of allocating new one
            const verts = this.cachedVerts;
            verts[0] = x;
            verts[1] = y;
            verts[2] = x;
            verts[3] = y + hq;
            verts[4] = x + w;
            verts[5] = y + hq;
            verts[6] = x;
            verts[7] = y;
            verts[8] = x + w;
            verts[9] = y + hq;
            verts[10] = x + w;
            verts[11] = y;
            this.tint[0] = this.tint[1] = this.tint[2] = this.tint[3] = 1.0;
            this.positions.data(verts);
            this.drawCall
                .uniform("u_screenSize", this.screenSize)
                .uniform("u_centerWorld", this.centerWorld)
                .texture("u_sprite", f.tex)
                .draw();
        }
    }

    dispose(): void {
        try {
            this.positions?.delete?.();
            this.uvs?.delete?.();
            this.array?.delete?.();
        } catch {}
        this.positions = undefined;
        this.uvs = undefined;
        this.array = undefined;
        this.destroyFrames();
    }

    // Public API: spawn a cross animation using tile + screen coordinates
    spawn(
        tileX: number,
        tileY: number,
        screenX: number,
        screenY: number,
        basePlane: number,
        atTime?: number,
        variant: "yellow" | "red" = "yellow",
    ): void {
        const t = atTime ?? this.lastArgs?.time ?? performance.now();
        const frameOffset = variant === "red" ? this.redOffset : this.yellowOffset;
        this.queue.push({
            x: tileX | 0,
            y: tileY | 0,
            screenX: screenX | 0,
            screenY: screenY | 0,
            basePlane: basePlane | 0,
            startTime: t | 0,
            frameOffset,
        });
    }

    private initFramesFromCache(): void {
        try {
            const cacheSystem = this.ctx.getCacheSystem?.();
            if (!cacheSystem) return; // Cache not loaded yet
            const spriteIndex = cacheSystem.getIndex(IndexType.DAT2.sprites);
            const sid = this.spriteId | 0;
            const sprites = SpriteLoader.loadIntoIndexedSprites(spriteIndex, sid);
            if (!sprites || sprites.length === 0) return;
            const frames: Array<{ tex: Texture; w: number; h: number }> = [];
            // Load all available frames so we can use 0..3 (yellow) and 4..7 (red)
            const use = sprites.length | 0;
            for (let i = 0; i < use; i++) {
                const sp = sprites[i] as IndexedSprite;
                frames.push({
                    tex: this.createTextureFromIndexedSprite(sp),
                    w: sp.subWidth | 0,
                    h: sp.subHeight | 0,
                });
            }
            this.frames = frames;
        } catch (e) {
            console.warn("[ClickCrossOverlay] failed to load sprite frames", e);
        }
    }

    private destroyFrames(): void {
        if (!this.frames) return;
        for (const f of this.frames) {
            try {
                f.tex.delete?.();
            } catch {}
        }
        this.frames = undefined;
    }

    private createTextureFromIndexedSprite(spr: IndexedSprite): Texture {
        const w = spr.subWidth | 0 || 1;
        const h = spr.subHeight | 0 || 1;
        const out = new Uint8Array(w * h * 4);
        const pal = spr.palette;
        const spx = spr.pixels;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = spx[x + y * w] & 0xff;
                if (idx === 0) continue;
                const rgb = pal[idx] | 0;
                const di = (x + y * w) * 4;
                out[di] = (rgb >> 16) & 0xff;
                out[di + 1] = (rgb >> 8) & 0xff;
                out[di + 2] = rgb & 0xff;
                out[di + 3] = 255;
            }
        }
        return this.app.createTexture2D(out, w, h, {
            internalFormat: PicoGL.RGBA8,
            type: PicoGL.UNSIGNED_BYTE,
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
            wrapS: PicoGL.CLAMP_TO_EDGE,
            wrapT: PicoGL.CLAMP_TO_EDGE,
        });
    }
}
