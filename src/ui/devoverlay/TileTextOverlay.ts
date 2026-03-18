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

export interface TileTextContext {
    getCacheSystem: () => any;
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

export class TileTextOverlay implements Overlay {
    constructor(
        private program: Program,
        private ctx: TileTextContext,
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
    private static readonly MAX_GLYPHS_PER_ENTRY = 32;
    private static readonly VERTS_PER_GLYPH = 6 * 2; // 6 vertices × 2 coords
    private batchedVerts = new Float32Array(
        TileTextOverlay.MAX_GLYPHS_PER_ENTRY * TileTextOverlay.VERTS_PER_GLYPH,
    );
    private batchedUvs = new Float32Array(
        TileTextOverlay.MAX_GLYPHS_PER_ENTRY * TileTextOverlay.VERTS_PER_GLYPH,
    );

    // Font atlas
    private tex?: Texture;
    private glyphs = new Map<number, GlyphMeta>();
    private ascent: number = 12;

    // Controls
    fontId: number = FONT_BOLD_12; // OSRS Small default
    scale: number = 1.0;
    color: number = 0xffffff;

    private lastArgs?: OverlayUpdateArgs;

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // PERF: Create buffers large enough for batched rendering
        const bufferSize = TileTextOverlay.MAX_GLYPHS_PER_ENTRY * TileTextOverlay.VERTS_PER_GLYPH;
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
        this.buildAtlas(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,:'-_.()[]/+",
        );
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.drawCall || !this.positions || !this.uvs || !this.tex) return;
        const args = this.lastArgs;
        if (!args) return;

        const entries: Array<{
            x: number;
            y: number;
            basePlane: number;
            dy: number;
            color: number;
            mode: "tileFlags" | "coordsOnly";
            textOverride?: string;
        }> = [];
        const state = args.state;
        const basePlane = state.playerLevel | 0;

        if (state.hoverEnabled && state.hoverTile) {
            const hoverX = state.hoverTile.x | 0;
            const hoverY = state.hoverTile.y | 0;
            entries.push({
                x: hoverX,
                y: hoverY,
                basePlane,
                dy: 0.6,
                color: 0xffff00,
                mode: "coordsOnly",
                textOverride: `tile (${hoverX}, ${hoverY})`,
            });
        }

        if (entries.length === 0) return;

        // Screen state
        this.screenSize[0] = this.app.width;
        this.screenSize[1] = this.app.height;
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);

        const scale = this.scale || 1.0;

        for (const e of entries) {
            let text: string;
            if (e.mode === "tileFlags") {
                // Compose text: coords and tile flags for levels 0..3 (decimal)
                const f0 = args.helpers.getTileRenderFlagAt(0, e.x, e.y) | 0;
                const f1 = args.helpers.getTileRenderFlagAt(1, e.x, e.y) | 0;
                const f2 = args.helpers.getTileRenderFlagAt(2, e.x, e.y) | 0;
                const f3 = args.helpers.getTileRenderFlagAt(3, e.x, e.y) | 0;
                text = `${e.x}, ${e.y} ${f0},${f1},${f2},${f3})`;
            } else {
                text = e.textOverride ?? "";
            }
            if (text.length === 0) continue;

            // Resolve anchor
            const effPlane = args.helpers.getEffectivePlaneForTile(e.x, e.y, e.basePlane) | 0;
            // Use exact plane height without further promotion to match tile outline
            const h = args.helpers.sampleHeightAtExactPlane(e.x + 0.5, e.y + 0.5, effPlane);
            this.centerWorld[0] = e.x + 0.5;
            this.centerWorld[1] = h - e.dy;
            this.centerWorld[2] = e.y + 0.5;

            // Color
            const col = e.color >>> 0;
            this.tint[0] = ((col >> 16) & 0xff) / 255.0;
            this.tint[1] = ((col >> 8) & 0xff) / 255.0;
            this.tint[2] = (col & 0xff) / 255.0;
            this.tint[3] = 1.0;

            // PERF: Batched rendering - build all glyphs, then draw once
            let advTotal = 0;
            for (let i = 0; i < text.length; i++) {
                const g = this.glyphs.get(text.charCodeAt(i));
                advTotal += (g?.adv ?? g?.w ?? 0) + (i > 0 ? 0.75 : 0);
            }
            const textWidth = advTotal * scale;
            const textHeight = this.ascent * scale;
            let penX = -(textWidth / 2);
            let penY = -(textHeight / 2);

            // Keep labels visible when hovering near viewport edges.
            const anchorScreen = args.helpers.worldToScreen?.(
                this.centerWorld[0],
                this.centerWorld[1],
                this.centerWorld[2],
            );
            if (anchorScreen) {
                const pad = 2;
                const anchorX = anchorScreen[0] | 0;
                const anchorY = anchorScreen[1] | 0;

                const left = anchorX + penX;
                const right = left + textWidth;
                if (left < pad) {
                    penX += pad - left;
                } else if (right > this.screenSize[0] - pad) {
                    penX -= right - (this.screenSize[0] - pad);
                }

                const top = anchorY + penY;
                const bottom = top + textHeight;
                if (top < pad) {
                    penY += pad - top;
                } else if (bottom > this.screenSize[1] - pad) {
                    penY -= bottom - (this.screenSize[1] - pad);
                }
            }

            const verts = this.batchedVerts;
            const uvs = this.batchedUvs;
            let glyphCount = 0;
            const maxGlyphs = TileTextOverlay.MAX_GLYPHS_PER_ENTRY;

            for (let i = 0; i < text.length && glyphCount < maxGlyphs; i++) {
                const ch = text.charCodeAt(i);
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
                    .texture("u_sprite", this.tex)
                    .draw();
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
            // Compute atlas dims
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
            console.error("TileTextOverlay: failed to build glyph atlas", e);
        }
    }
}
