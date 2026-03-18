import { App as PicoApp, PicoGL, Program, UniformBuffer, VertexArray, VertexBuffer } from "picogl";

import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

export interface PathOverlayContext {
    // Returns a copy of the last server path, if any
    getPath: () => { x: number; y: number }[] | undefined;
}

export class PathOverlay implements Overlay {
    constructor(
        private program: Program,
        private ctx: PathOverlayContext,
    ) {}

    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;
    private positions?: VertexBuffer; // vec3 (quad corners)
    private array?: VertexArray;
    private colorFill = new Float32Array([1.0, 0.95, 0.0, 0.25]); // yellow, translucent
    private colorEdge = new Float32Array([1.0, 0.95, 0.0, 0.85]);
    private lastArgs?: OverlayUpdateArgs;
    // PERF: Cached arrays to avoid per-frame allocations
    private cachedQuadVerts = new Float32Array(4 * 3);

    // PERF: Cached DrawCall to avoid per-frame allocation
    private drawCall?: ReturnType<PicoApp["createDrawCall"]>;

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;
        this.positions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(4 * 3));
        this.array = this.app.createVertexArray().vertexAttributeBuffer(0, this.positions);
        // PERF: Create DrawCall once at init, reuse each frame
        this.drawCall = this.app
            .createDrawCall(this.program, this.array)
            .uniformBlock("SceneUniforms", this.sceneUniforms)
            .primitive(PicoGL.TRIANGLE_FAN);
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.positions || !this.array || !this.drawCall) return;
        const args = this.lastArgs;
        if (!args) return;
        const waypoints = this.ctx.getPath?.();
        if (!waypoints || waypoints.length === 0) return;

        const basePlane = (args.state.playerRawLevel ?? args.state.playerLevel) | 0;
        const { getTileHeightAtPlane, getEffectivePlaneForTile } = args.helpers;
        if (!getTileHeightAtPlane) return;

        this.app.defaultDrawFramebuffer();
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);
        this.app.disable(PicoGL.CULL_FACE as any);

        const inset = 0.12; // visual inset to match dev overlay style
        const verts = this.cachedQuadVerts; // PERF: Reuse cached array

        for (const wp of waypoints) {
            const tx = wp.x | 0;
            const ty = wp.y | 0;
            const effPlane = getEffectivePlaneForTile(tx, ty, basePlane);
            const x0 = tx + inset;
            const z0 = ty + inset;
            const x1 = tx + 1 - inset;
            const z1 = ty + 1 - inset;
            verts[0] = x0;
            verts[1] = getTileHeightAtPlane(x0, z0, effPlane) - 0.015;
            verts[2] = z0;
            verts[3] = x1;
            verts[4] = getTileHeightAtPlane(x1, z0, effPlane) - 0.015;
            verts[5] = z0;
            verts[6] = x1;
            verts[7] = getTileHeightAtPlane(x1, z1, effPlane) - 0.015;
            verts[8] = z1;
            verts[9] = x0;
            verts[10] = getTileHeightAtPlane(x0, z1, effPlane) - 0.015;
            verts[11] = z1;
            this.positions!.data(verts);
            this.drawCall.uniform("u_color", this.colorFill).draw();
        }
    }

    dispose(): void {
        try {
            this.positions?.delete?.();
            this.array?.delete?.();
        } catch {}
        this.positions = undefined;
        this.array = undefined;
    }
}
