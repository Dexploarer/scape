import { vec3 } from "gl-matrix";
import {
    App as PicoApp,
    PicoGL,
    Program,
    Texture,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import type { GroundItemOverlayEntry } from "../../client/data/ground/GroundItemStore";
import { BitmapFont } from "../../rs/font/BitmapFont";
import { FONT_PLAIN_11 } from "../fonts";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

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

export class GroundItemOverlay implements Overlay {
    constructor(
        private program: Program,
        private ctx: { getCacheSystem: () => any },
    ) {}

    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;
    private positions?: VertexBuffer;
    private uvs?: VertexBuffer;
    private array?: VertexArray;
    private drawCall?: any;
    private tex?: Texture;
    private glyphs = new Map<number, GlyphMeta>();
    private ascent: number = 12;
    private screenSize = new Float32Array(2);
    private tint = new Float32Array([1, 1, 1, 1]);
    private centerWorld = vec3.create();
    private entries: GroundItemOverlayEntry[] = [];
    private lastArgs?: OverlayUpdateArgs;
    // PERF: Batched rendering - large buffers to hold multiple glyphs per draw call
    private static readonly MAX_GLYPHS_PER_ENTRY = 64;
    private static readonly VERTS_PER_GLYPH = 6 * 2; // 6 vertices × 2 coords (x, y)
    private batchedVerts = new Float32Array(
        GroundItemOverlay.MAX_GLYPHS_PER_ENTRY * GroundItemOverlay.VERTS_PER_GLYPH,
    );
    private batchedUvs = new Float32Array(
        GroundItemOverlay.MAX_GLYPHS_PER_ENTRY * GroundItemOverlay.VERTS_PER_GLYPH,
    );

    // Use native-size 11px font to keep text crisp (avoid fractional downscaling blur).
    fontId: number = FONT_PLAIN_11;
    scale: number = 1.0;

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // PERF: Create buffers large enough to hold MAX_GLYPHS_PER_ENTRY glyphs for batched rendering
        const bufferSize =
            GroundItemOverlay.MAX_GLYPHS_PER_ENTRY * GroundItemOverlay.VERTS_PER_GLYPH;
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

        this.buildAtlas(
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()[]{}-+:'!?. ,x",
        );
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
        // Renderer updates overlays multiple times per frame.
        // Only consume groundItems when that field is explicitly present;
        // otherwise preserve entries from the previous update pass.
        if (Object.prototype.hasOwnProperty.call(args.state, "groundItems")) {
            this.entries = Array.isArray(args.state.groundItems) ? args.state.groundItems : [];
        }
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.drawCall || !this.positions || !this.uvs || !this.tex) return;
        const args = this.lastArgs;
        if (!args || this.entries.length === 0) return;

        this.screenSize[0] = this.app.width;
        this.screenSize[1] = this.app.height;
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);

        const scale = this.scale || 1.0;

        for (const entry of this.entries) {
            const baseLabel = typeof entry.label === "string" ? entry.label : "";
            const timerLabel = typeof entry.timerLabel === "string" ? entry.timerLabel : "";
            if (baseLabel.length === 0 && timerLabel.length === 0) {
                continue;
            }

            // Use the ground stack's actual plane as the base input for height sampling.
            // Ground piles stay indexed on the raw plane; bridge promotion belongs in the
            // height sampler, not in interaction/effective-plane resolution.
            const h = args.helpers.getTileHeightAtPlane(
                entry.tileX + 0.5,
                entry.tileY + 0.5,
                entry.level,
            );
            const line = Math.max(0, entry.line ?? 0);
            this.centerWorld[0] = entry.tileX + 0.5;
            this.centerWorld[1] = h - 0.05 - line * 0.22;
            this.centerWorld[2] = entry.tileY + 0.5;

            const penY = -((this.ascent * scale) / 2);
            const baseWidth = this.measureTextAdvance(baseLabel);
            const baseStartX = -((baseWidth * scale) / 2);

            this.setTintColor(entry.color ?? 0xffffff);
            this.drawLabelBatch(baseLabel, baseStartX, penY, scale);

            if (timerLabel.length > 0) {
                this.setTintColor(
                    Number.isFinite(entry.timerColor) ? (entry.timerColor as number) : 0xffff00,
                );
                this.drawLabelBatch(timerLabel, baseStartX + baseWidth * scale, penY, scale);
            }
        }
    }

    private setTintColor(color: number): void {
        const col = (color ?? 0xffffff) >>> 0;
        this.tint[0] = ((col >> 16) & 0xff) / 255.0;
        this.tint[1] = ((col >> 8) & 0xff) / 255.0;
        this.tint[2] = (col & 0xff) / 255.0;
        this.tint[3] = 1.0;
    }

    private measureTextAdvance(text: string): number {
        let advance = 0;
        for (let i = 0; i < text.length; i++) {
            const g = this.glyphs.get(text.charCodeAt(i));
            advance += (g?.adv ?? g?.w ?? 0) + (i > 0 ? 0.75 : 0);
        }
        return advance;
    }

    private drawLabelBatch(text: string, startX: number, penY: number, scale: number): void {
        if (!this.positions || !this.uvs || !this.drawCall || !this.tex) return;
        if (text.length === 0) return;

        const verts = this.batchedVerts;
        const uvs = this.batchedUvs;
        let glyphCount = 0;
        let penX = startX;
        const maxGlyphs = GroundItemOverlay.MAX_GLYPHS_PER_ENTRY;

        for (let i = 0; i < text.length && glyphCount < maxGlyphs; i++) {
            const ch = text.charCodeAt(i);
            const g = this.glyphs.get(ch);
            if (!g) continue;
            const gw = Math.max(1, (g.w * scale) | 0);
            const gh = Math.max(1, (g.h * scale) | 0);
            const gx = (penX + g.lb * scale) | 0;
            const gy = (penY + g.tb * scale) | 0;

            const vi = glyphCount * 12; // 6 vertices × 2 coords per glyph
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

        if (glyphCount <= 0) return;

        const vertCount = glyphCount * 12;
        this.positions.data(verts.subarray(0, vertCount));
        this.uvs.data(uvs.subarray(0, vertCount));
        this.drawCall
            .uniform("u_screenSize", this.screenSize)
            .uniform("u_centerWorld", this.centerWorld)
            .texture("u_sprite", this.tex)
            .draw();
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
            let bmp = BitmapFont.tryLoad(this.ctx.getCacheSystem(), this.fontId);
            if (!bmp && this.fontId !== FONT_PLAIN_11) {
                bmp = BitmapFont.tryLoad(this.ctx.getCacheSystem(), FONT_PLAIN_11);
            }
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
            console.error("GroundItemOverlay: failed to build glyph atlas", e);
        }
    }
}
