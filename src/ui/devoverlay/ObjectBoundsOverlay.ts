import { App as PicoApp, DrawCall, PicoGL, Program, UniformBuffer, VertexArray, VertexBuffer } from "picogl";

import type { Aabb } from "../../client/math/Aabb";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

export interface ObjectBoundsOverlayContext {
    /** Return an array of per-object world-space AABBs for the current frame. */
    getObjectBounds: () => Aabb[];
}

export class ObjectBoundsOverlay implements Overlay {
    constructor(
        private program: Program,
        private ctx: ObjectBoundsOverlayContext,
    ) {}

    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;

    private linePositions?: VertexBuffer;
    private lineArray?: VertexArray;
    // PERF: Cached drawCall to avoid creating new one every frame
    private drawCall?: DrawCall;

    private lineColor = new Float32Array([0.7, 0.0, 0.9, 1.0]); // purple
    private cachedVerts?: Float32Array;
    // PERF: Cached empty Float32Array for when no boxes
    private emptyVerts = new Float32Array(0);
    // PERF: Static edge indices for AABB wireframe - hoisted out of draw loop
    private static readonly EDGES = [
        [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
        [4, 5], [5, 6], [6, 7], [7, 4], // top face
        [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
    ] as const;

    enabled: boolean = true;

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // Single dynamic buffer reused for all boxes each frame (batched)
        // Allocate a reasonable default; will grow on first .data()
        // Start with capacity for 8 boxes; grows via data().
        this.linePositions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, 24 * 2 * 3 * 4 * 8);
        this.lineArray = this.app.createVertexArray().vertexAttributeBuffer(0, this.linePositions);
        // Ensure VAO count matches buffer on init
        this.lineArray.numElements = 0;

        // PERF: Create drawCall once in init() instead of every frame
        this.drawCall = this.app
            .createDrawCall(this.program, this.lineArray)
            .uniformBlock("SceneUniforms", this.sceneUniforms)
            .uniform("u_color", this.lineColor)
            .primitive(PicoGL.LINES);
    }

    update(_args: OverlayUpdateArgs): void {
        // No per-frame state needed; we query bounds directly in draw().
    }

    draw(phase: RenderPhase): void {
        if (!this.enabled) return;
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.lineArray || !this.linePositions || !this.drawCall) return;

        const boxes = this.ctx.getObjectBounds?.() ?? [];
        if (!boxes.length) {
            if (this.linePositions) {
                // PERF: Reuse cached empty array instead of allocating new one
                this.linePositions.data(this.emptyVerts);
                this.linePositions.numItems = 0;
            }
            if (this.lineArray) {
                this.lineArray.numElements = 0;
            }
            return;
        }

        // PERF: Reuse cached drawCall instead of creating new one every frame
        const drawCall = this.drawCall;

        // 12 edges * 2 vertices * 3 components
        const neededFloats = boxes.length * 24 * 3;
        let verts = this.cachedVerts;
        if (!verts || verts.length < neededFloats) {
            verts = new Float32Array(Math.max(neededFloats, 24 * 3 * 8));
            this.cachedVerts = verts;
        }
        let vi = 0;
        // PERF: Inline corner lookups to avoid creating array per box
        // Corners: 0=[minX,minY,minZ], 1=[maxX,minY,minZ], 2=[maxX,maxY,minZ], 3=[minX,maxY,minZ]
        //          4=[minX,minY,maxZ], 5=[maxX,minY,maxZ], 6=[maxX,maxY,maxZ], 7=[minX,maxY,maxZ]
        const edges = ObjectBoundsOverlay.EDGES;
        for (let bi = 0; bi < boxes.length; bi++) {
            const { minX, minY, minZ, maxX, maxY, maxZ } = boxes[bi];
            for (let ei = 0; ei < edges.length; ei++) {
                const [a, b] = edges[ei];
                // Inline corner lookup for vertex a
                const ax = (a & 1) ? maxX : minX;
                const ay = (a & 2) ? maxY : minY;
                const az = (a & 4) ? maxZ : minZ;
                // Inline corner lookup for vertex b
                const bx = (b & 1) ? maxX : minX;
                const by = (b & 2) ? maxY : minY;
                const bz = (b & 4) ? maxZ : minZ;
                verts[vi++] = ax;
                verts[vi++] = ay;
                verts[vi++] = az;
                verts[vi++] = bx;
                verts[vi++] = by;
                verts[vi++] = bz;
            }
        }

        // Upload combined verts and update counts so drawCall knows total lines.
        const vertCount = neededFloats / 3;
        this.linePositions.data(verts.subarray(0, neededFloats));
        this.linePositions.numItems = vertCount;
        if (this.lineArray) {
            this.lineArray.numElements = vertCount;
        }

        this.app.defaultDrawFramebuffer();
        this.app.disable(PicoGL.DEPTH_TEST);
        this.app.enable(PicoGL.BLEND);
        drawCall.draw();
        this.app.disable(PicoGL.BLEND);
    }

    dispose(): void {
        try {
            this.linePositions?.delete?.();
            this.lineArray?.delete?.();
        } catch {}
        this.linePositions = undefined;
        this.lineArray = undefined;
    }
}
