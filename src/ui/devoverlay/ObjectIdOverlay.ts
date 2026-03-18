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

import { BitmapFont } from "../../rs/font/BitmapFont";
import { FONT_BOLD_12 } from "../fonts";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

export interface ObjectIdOverlayContext {
    getCacheSystem: () => any;
    // Return list of {id, level} present at the tile across all planes
    getLocIdsAtTileAllLevels: (tileX: number, tileY: number) => { id: number; level: number }[];
    // Whether a given loc id is interactable
    isLocInteractable?: (id: number) => boolean;
}

type GlyphMeta = {
    ch: number;
    u0: number;
    v0: number;
    u1: number;
    v1: number;
    w: number;
    h: number;
    lb: number;
    tb: number;
    adv: number;
};

export class ObjectIdOverlay implements Overlay {
    constructor(
        private program: Program,
        private ctx: ObjectIdOverlayContext,
    ) {}

    // GPU state
    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;
    private positions?: VertexBuffer; // vec2 (px)
    private uvs?: VertexBuffer; // vec2
    private array?: VertexArray;
    private drawCall?: DrawCall;

    private screenSize = new Float32Array(2);
    private centerWorld = vec3.create();
    private tint = new Float32Array([1, 1, 1, 1]);
    // PERF: Batched rendering - large buffers to hold multiple glyphs per draw call
    // Object IDs can be up to 5-6 digits, so 16 glyphs is plenty
    private static readonly MAX_GLYPHS_PER_ENTRY = 16;
    private static readonly VERTS_PER_GLYPH = 6 * 2; // 6 vertices × 2 coords
    private batchedVerts = new Float32Array(
        ObjectIdOverlay.MAX_GLYPHS_PER_ENTRY * ObjectIdOverlay.VERTS_PER_GLYPH,
    );
    private batchedUvs = new Float32Array(
        ObjectIdOverlay.MAX_GLYPHS_PER_ENTRY * ObjectIdOverlay.VERTS_PER_GLYPH,
    );

    // Font atlas
    private tex?: Texture;
    private glyphs = new Map<number, GlyphMeta>();
    private ascent: number = 12;

    // Controls
    fontId: number = FONT_BOLD_12; // OSRS Small default
    scale: number = 1.0;
    color: number = 0xffffff;
    radius: number = 24; // tiles around player
    lineGap: number = 0.5; // world Y gap between stacked labels

    private lastArgs?: OverlayUpdateArgs;
    private lastPlayerWorld?: { x: number; y: number; plane: number };
    // Toggle from DevTools
    enabled: boolean = true;

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // PERF: Create buffers large enough for batched rendering
        const bufferSize = ObjectIdOverlay.MAX_GLYPHS_PER_ENTRY * ObjectIdOverlay.VERTS_PER_GLYPH;
        this.positions = this.app.createVertexBuffer(PicoGL.FLOAT, 2, new Float32Array(bufferSize));
        this.uvs = this.app.createVertexBuffer(PicoGL.FLOAT, 2, new Float32Array(bufferSize));
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

        // Build an atlas for needed characters
        this.buildAtlas("0123456789");
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
        // Capture player world position if present
        const px = args.state.playerWorldX;
        const pz = args.state.playerWorldZ;
        if (px != null && pz != null) {
            const plane = args.state.playerLevel | 0;
            this.lastPlayerWorld = { x: px, y: pz, plane };
        }
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.enabled) return;
        if (!this.drawCall || !this.positions || !this.uvs || !this.tex) return;
        const args = this.lastArgs;
        const player = this.lastPlayerWorld;
        if (!args || !player) return;

        // Screen state
        this.screenSize[0] = this.app.width;
        this.screenSize[1] = this.app.height;
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);

        const scale = this.scale || 1.0;
        const basePlane = player.plane | 0;
        const cx = Math.floor(player.x + 0.5);
        const cy = Math.floor(player.y + 0.5);
        const r = Math.max(1, this.radius | 0);
        const r2 = r * r;

        // Iterate tiles in a diamond or square around player; use square for simplicity
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const tx = cx + dx;
                const ty = cy + dy;
                // Cull using Euclidean tile distance from player
                if (dx * dx + dy * dy > r2) continue;
                // Query loc ids anchored at this tile across all planes
                const pairs = this.ctx.getLocIdsAtTileAllLevels(tx, ty) || [];
                if (!pairs || pairs.length === 0) continue;
                // Deduplicate by id, prefer smallest level (closest to base)
                const idToLevel = new Map<number, number>();
                for (const { id, level } of pairs) {
                    const prev = idToLevel.get(id);
                    if (prev == null || level < prev) idToLevel.set(id, level);
                }
                const ids = Array.from(idToLevel.keys());

                // Stack labels at this tile; draw each id as its own line
                for (let i = 0; i < ids.length; i++) {
                    const id = ids[i] | 0;
                    // Use basePlane directly for height sampling (not getEffectivePlaneForTile)
                    // to avoid incorrect plane promotion under bridges.
                    const h = args.helpers.getTileHeightAtPlane(tx + 0.5, ty + 0.5, basePlane);
                    this.centerWorld[0] = tx + 0.5;
                    this.centerWorld[1] = h - (0.5 + i * this.lineGap);
                    this.centerWorld[2] = ty + 0.5;

                    // No roof culling - always visible
                    const col = this.color >>> 0;
                    this.tint[0] = ((col >> 16) & 0xff) / 255.0;
                    this.tint[1] = ((col >> 8) & 0xff) / 255.0;
                    this.tint[2] = (col & 0xff) / 255.0;
                    this.tint[3] = 1.0;

                    const text = `${id}`;
                    // Measure
                    let advTotal = 0;
                    for (let c = 0; c < text.length; c++) {
                        const g = this.glyphs.get(text.charCodeAt(c));
                        advTotal += (g?.adv ?? g?.w ?? 0) + (c > 0 ? 0.75 : 0);
                    }
                    let penX = -((advTotal * scale) / 2);
                    const penY = -((this.ascent * scale) / 2);

                    // PERF: Batched rendering - build all glyphs, then draw once
                    const verts = this.batchedVerts;
                    const uvs = this.batchedUvs;
                    let glyphCount = 0;
                    const maxGlyphs = ObjectIdOverlay.MAX_GLYPHS_PER_ENTRY;

                    for (let c = 0; c < text.length && glyphCount < maxGlyphs; c++) {
                        const ch = text.charCodeAt(c);
                        const g = this.glyphs.get(ch);
                        if (!g) continue;
                        const gw = (g.w * scale) | 0;
                        const gh = (g.h * scale) | 0;
                        const gx = (penX + g.lb * scale) | 0;
                        const gy = (penY + g.tb * scale) | 0;

                        const vi = glyphCount * 12;
                        verts[vi + 0] = gx;
                        verts[vi + 1] = gy;
                        verts[vi + 2] = gx;
                        verts[vi + 3] = gy + gh;
                        verts[vi + 4] = gx + gw;
                        verts[vi + 5] = gy + gh;
                        verts[vi + 6] = gx;
                        verts[vi + 7] = gy;
                        verts[vi + 8] = gx + gw;
                        verts[vi + 9] = gy + gh;
                        verts[vi + 10] = gx + gw;
                        verts[vi + 11] = gy;
                        uvs[vi + 0] = g.u0;
                        uvs[vi + 1] = g.v0;
                        uvs[vi + 2] = g.u0;
                        uvs[vi + 3] = g.v1;
                        uvs[vi + 4] = g.u1;
                        uvs[vi + 5] = g.v1;
                        uvs[vi + 6] = g.u0;
                        uvs[vi + 7] = g.v0;
                        uvs[vi + 8] = g.u1;
                        uvs[vi + 9] = g.v1;
                        uvs[vi + 10] = g.u1;
                        uvs[vi + 11] = g.v0;

                        penX += (g.adv ?? g.w) * scale + 0.75 * scale;
                        glyphCount++;
                    }

                    if (glyphCount > 0) {
                        const vertCount = glyphCount * 12;
                        this.positions.data(verts.subarray(0, vertCount));
                        this.uvs.data(uvs.subarray(0, vertCount));
                        this.drawCall
                            .uniform("u_screenSize", this.screenSize)
                            .uniform("u_centerWorld", this.centerWorld)
                            .texture("u_sprite", this.tex!)
                            .draw();
                    }
                }
            }
        }
    }

    dispose(): void {
        try {
            this.positions?.delete?.();
            this.uvs?.delete?.();
            this.array?.delete?.();
            this.tex?.delete?.();
        } catch {}
        this.positions = undefined;
        this.uvs = undefined;
        this.array = undefined;
        this.tex = undefined;
        this.glyphs.clear();
    }

    private buildAtlas(charset: string): void {
        try {
            const bmp = BitmapFont.tryLoad(this.ctx.getCacheSystem(), this.fontId);
            if (!bmp) return;
            this.ascent = bmp.ascent | 0;
            const chars = Array.from(new Set(charset.split(""))).map((c) => c.charCodeAt(0));
            let W = 2;
            let H = 1;
            const metas: GlyphMeta[] = [];
            for (const ch of chars) {
                const w = bmp.widths[ch] | 0 || 1;
                const h = bmp.heights[ch] | 0 || 1;
                const lb = bmp.leftBearings[ch] | 0;
                const tb = bmp.topBearings[ch] | 0;
                const adv = bmp.advances[ch] | 0 || w;
                metas.push({ ch, u0: 0, v0: 0, u1: 0, v1: 0, w, h, lb, tb, adv });
                W += w + 1;
                H = Math.max(H, h);
            }
            W |= 0;
            H = Math.max(1, H | 0);
            const out = new Uint8Array(W * H * 4);
            let penX = 1;
            for (const m of metas) {
                const gp = bmp.glyphPixels[m.ch];
                const w = m.w | 0;
                const h = m.h | 0;
                if (gp) {
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const idx = gp[y * w + x] & 0xff;
                            if (idx === 0) continue;
                            const di = (penX + x + y * W) * 4;
                            out[di] = 255;
                            out[di + 1] = 255;
                            out[di + 2] = 255;
                            out[di + 3] = 255;
                        }
                    }
                }
                m.u0 = penX / W;
                m.v0 = 0;
                m.u1 = (penX + w) / W;
                m.v1 = h / H;
                this.glyphs.set(m.ch, m);
                penX += w + 1;
            }
            this.tex = this.app.createTexture2D(out, W, H, {
                internalFormat: PicoGL.RGBA8,
                type: PicoGL.UNSIGNED_BYTE,
                minFilter: PicoGL.NEAREST,
                magFilter: PicoGL.NEAREST,
                wrapS: PicoGL.CLAMP_TO_EDGE,
                wrapT: PicoGL.CLAMP_TO_EDGE,
            });
        } catch (e) {
            console.error("ObjectIdOverlay: failed to build glyph atlas", e);
        }
    }
}
