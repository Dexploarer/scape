import {
    DrawCall,
    App as PicoApp,
    PicoGL,
    Program,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import { CollisionFlag as CF } from "../../client/collision/CollisionFlags";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

export class WalkableOverlay implements Overlay {
    constructor(private program: Program) {}

    private app!: PicoApp;
    private sceneUniforms!: UniformBuffer;

    private positions?: VertexBuffer; // vec3 positions (4 verts for a thick strip)
    private array?: VertexArray;
    // PERF: Cache drawCall to avoid creating it every frame
    private drawCall?: DrawCall;
    // PERF: Cached verts array to avoid allocation per updateEdgeStrip/updateTileInsetQuad call
    private cachedVerts = new Float32Array(4 * 3);

    private color = new Float32Array([1, 0, 0, 0.35]);

    // Controls
    radius: number = 12;
    enabled: boolean = true;
    colorEdgeBlocked = new Float32Array([1.0, 0.0, 0.0, 0.85]);
    colorCenterBlocked = new Float32Array([1.0, 0.0, 0.0, 0.28]);
    colorCenterWalkable = new Float32Array([0.15, 0.9, 0.15, 0.2]);
    edgeThickness: number = 0.05; // in world tile units

    private lastArgs?: OverlayUpdateArgs;

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // Thick line as strip (4 vertices)
        this.positions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(4 * 3));
        this.array = this.app.createVertexArray().vertexAttributeBuffer(0, this.positions);

        // PERF: Create drawCall once in init() instead of every frame in draw()
        this.drawCall = this.app
            .createDrawCall(this.program, this.array)
            .uniformBlock("SceneUniforms", this.sceneUniforms)
            .uniform("u_color", this.color)
            .primitive(PicoGL.TRIANGLE_STRIP);
    }

    update(args: OverlayUpdateArgs): void {
        this.lastArgs = args;
    }

    private updateEdgeStrip(
        getH: (x: number, y: number) => number,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        thickness: number,
    ) {
        const dx = x1 - x0;
        const dz = y1 - y0;
        const len = Math.hypot(dx, dz) || 1.0;
        const nx = (-dz / len) * (thickness * 0.5);
        const nz = (dx / len) * (thickness * 0.5);

        const ax0 = x0 - nx;
        const az0 = y0 - nz;
        const ax1 = x0 + nx;
        const az1 = y0 + nz;
        const bx0 = x1 - nx;
        const bz0 = y1 - nz;
        const bx1 = x1 + nx;
        const bz1 = y1 + nz;

        // PERF: Reuse cached verts array instead of creating new one
        const verts = this.cachedVerts;
        // strip order: a0, a1, b0, b1
        verts[0] = ax0;
        verts[1] = getH(ax0, az0) - 0.02;
        verts[2] = az0;

        verts[3] = ax1;
        verts[4] = getH(ax1, az1) - 0.02;
        verts[5] = az1;

        verts[6] = bx0;
        verts[7] = getH(bx0, bz0) - 0.02;
        verts[8] = bz0;

        verts[9] = bx1;
        verts[10] = getH(bx1, bz1) - 0.02;
        verts[11] = bz1;

        this.positions!.data(verts);
    }

    private updateTileInsetQuad(
        getH: (x: number, y: number) => number,
        tileX: number,
        tileY: number,
        inset: number,
    ) {
        const i = Math.max(0.02, Math.min(0.49, inset));
        const x0 = tileX + i;
        const y0 = tileY + i;
        const x1 = tileX + 1 - i;
        const y1 = tileY + 1 - i;
        // PERF: Reuse cached verts array instead of creating new one
        const verts = this.cachedVerts;
        // corners (clockwise)
        verts[0] = x0;
        verts[1] = getH(x0, y0) - 0.015;
        verts[2] = y0;

        verts[3] = x1;
        verts[4] = getH(x1, y0) - 0.015;
        verts[5] = y0;

        verts[6] = x1;
        verts[7] = getH(x1, y1) - 0.015;
        verts[8] = y1;

        verts[9] = x0;
        verts[10] = getH(x0, y1) - 0.015;
        verts[11] = y1;
        this.positions!.data(verts);
    }

    draw(phase: RenderPhase): void {
        if (phase !== RenderPhase.PostPresent) return;
        if (!this.enabled || !this.positions || !this.array || !this.drawCall) return;
        const args = this.lastArgs;
        if (!args) return;

        // Need player world position and base plane
        const px = args.state.playerWorldX;
        const pz = args.state.playerWorldZ;
        if (px == null || pz == null) return;
        const basePlane = (args.state.playerRawLevel ?? args.state.playerLevel) | 0;

        const cx = Math.floor(px + 0.5);
        const cy = Math.floor(pz + 0.5);
        const r = Math.max(1, this.radius | 0);
        const r2 = r * r;

        const {
            getTileHeightAtPlane,
            getCollisionFlagAt,
            getEffectivePlaneForTile,
            getOccupancyPlaneForTile,
            isBridgeSurfaceTile,
        } = args.helpers;
        if (!getCollisionFlagAt) return;

        // PERF: Use cached drawCall instead of creating new one every frame
        const drawCall = this.drawCall;

        this.app.defaultDrawFramebuffer();
        this.app.enable(PicoGL.BLEND);
        this.app.disable(PicoGL.DEPTH_TEST);
        this.app.disable(PicoGL.CULL_FACE as any);

        const FLOOR_MASK = CF.FLOOR | CF.FLOOR_DECORATION;
        const TILE_BLOCK_MASK = FLOOR_MASK | CF.OBJECT;
        const isBridgeSurface = (x: number, y: number, plane: number): boolean =>
            isBridgeSurfaceTile?.(x, y, plane) ?? false;
        const adjustForBridge = (flag: number, mask: number, bridgeSurface: boolean): number => {
            if (!flag || !bridgeSurface) {
                return flag | 0;
            }
            return (flag & ~mask) | 0;
        };

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r2) continue;
                const tx = cx + dx;
                const ty = cy + dy;
                // Resolve effective plane using bridge rules for both height and collision sampling
                const occPlane =
                    getOccupancyPlaneForTile?.(tx, ty, basePlane) ??
                    getEffectivePlaneForTile(tx, ty, basePlane);
                const effPlane = getEffectivePlaneForTile(tx, ty, basePlane);

                const fHereRaw = getCollisionFlagAt(occPlane, tx, ty) | 0;
                const hereBridgeSurface = isBridgeSurface(tx, ty, occPlane);
                const occPlaneNorth =
                    getOccupancyPlaneForTile?.(tx, ty + 1, basePlane) ??
                    getEffectivePlaneForTile(tx, ty + 1, basePlane);
                const occPlaneEast =
                    getOccupancyPlaneForTile?.(tx + 1, ty, basePlane) ??
                    getEffectivePlaneForTile(tx + 1, ty, basePlane);

                const fHereForEdges = adjustForBridge(fHereRaw, FLOOR_MASK, hereBridgeSurface);
                const fHereForTile = adjustForBridge(fHereRaw, TILE_BLOCK_MASK, hereBridgeSurface);
                const fNorthRaw = getCollisionFlagAt(occPlaneNorth, tx, ty + 1) | 0;
                const northBridgeSurface = isBridgeSurface(tx, ty + 1, occPlaneNorth);
                const fNorthForEdges = adjustForBridge(fNorthRaw, FLOOR_MASK, northBridgeSurface);
                const fEastRaw = getCollisionFlagAt(occPlaneEast, tx + 1, ty) | 0;
                const eastBridgeSurface = isBridgeSurface(tx + 1, ty, occPlaneEast);
                const fEastForEdges = adjustForBridge(fEastRaw, FLOOR_MASK, eastBridgeSurface);

                // Union-per-edge: draw each edge once (north/east only) and color red if either side blocks that crossing
                const blockedNorth =
                    (fNorthForEdges & CF.BLOCK_NORTH) !== 0 ||
                    (fHereForEdges & CF.BLOCK_SOUTH) !== 0;
                const blockedEast =
                    (fEastForEdges & CF.BLOCK_EAST) !== 0 || (fHereForEdges & CF.BLOCK_WEST) !== 0;

                // Tile-level blocked state (full-tile object, floor decoration, or FLOOR)
                const tileBlocked = (fHereForTile & TILE_BLOCK_MASK) !== 0;

                // If neither edge is red, skip this tile entirely; south/west edges will be handled by neighbors
                if (!blockedNorth && !blockedEast && !tileBlocked) continue;

                const getH = (x: number, y: number) => getTileHeightAtPlane(x, y, effPlane);

                // Center fill: red if tile-level blocked, else green; draw inset
                this.updateTileInsetQuad(getH, tx, ty, 0.28);
                drawCall
                    .primitive(PicoGL.TRIANGLE_FAN)
                    .uniform(
                        "u_color",
                        tileBlocked ? this.colorCenterBlocked : this.colorCenterWalkable,
                    )
                    .draw();

                // North edge (between (tx,ty+1) and (tx+1,ty+1)) — draw only when blocked
                if (blockedNorth) {
                    this.updateEdgeStrip(getH, tx, ty + 1, tx + 1, ty + 1, this.edgeThickness);
                    drawCall
                        .primitive(PicoGL.TRIANGLE_STRIP)
                        .uniform("u_color", this.colorEdgeBlocked)
                        .draw();
                }

                // East edge (between (tx+1,ty) and (tx+1,ty+1)) — draw only when blocked
                if (blockedEast) {
                    this.updateEdgeStrip(getH, tx + 1, ty, tx + 1, ty + 1, this.edgeThickness);
                    drawCall
                        .primitive(PicoGL.TRIANGLE_STRIP)
                        .uniform("u_color", this.colorEdgeBlocked)
                        .draw();
                }
            }
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
