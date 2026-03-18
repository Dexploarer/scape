import { vec4 } from "gl-matrix";
import {
    DrawCall,
    App as PicoApp,
    PicoGL,
    Program,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import type { TileHighlightRenderEntry } from "../../client/highlights/TileHighlightManager";
import { Overlay, OverlayInitArgs, OverlayUpdateArgs, RenderPhase } from "./Overlay";

export class TileMarkerOverlay implements Overlay {
    constructor(private program: Program) {}

    // Colors (RGBA)
    hoverColor: vec4 = vec4.fromValues(1.0, 1.0, 0.0, 1.0);
    hoverFillColor: vec4 = vec4.fromValues(1.0, 1.0, 0.0, 0.25);
    destColor: vec4 = vec4.fromValues(0.0, 0.0, 1.0, 1.0);
    destFillColor: vec4 = vec4.fromValues(0.0, 0.0, 1.0, 0.2);
    currentColor: vec4 = vec4.fromValues(0.5, 0.5, 0.5, 1.0);
    serverTileColor: vec4 = vec4.fromValues(1.0, 0.0, 1.0, 1.0); // purple

    private app?: PicoApp;
    private sceneUniforms?: UniformBuffer;

    private hoverLinePositions?: VertexBuffer;
    private hoverLineArray?: VertexArray;
    private hoverLineDrawCall?: DrawCall;
    private hoverFillPositions?: VertexBuffer;
    private hoverFillArray?: VertexArray;
    private hoverFillDrawCall?: DrawCall;

    private destLinePositions?: VertexBuffer;
    private destLineArray?: VertexArray;
    private destLineDrawCall?: DrawCall;
    private destFillPositions?: VertexBuffer;
    private destFillArray?: VertexArray;
    private destFillDrawCall?: DrawCall;
    private currentLinePositions?: VertexBuffer;
    private currentLineArray?: VertexArray;
    private currentLineDrawCall?: DrawCall;
    private tileHighlights?: ReadonlyArray<TileHighlightRenderEntry>;
    private scratchLineColor: vec4 = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
    private scratchFillColor: vec4 = vec4.fromValues(1.0, 1.0, 1.0, 0.0);

    // PERF: Store tile data with plane instead of closure to avoid per-frame allocation
    private hoverTileData: { x: number; y: number; effPlane: number } | null = null;
    private destTileData: { x: number; y: number; effPlane: number } | null = null;
    private currentTileData: { x: number; y: number; effPlane: number } | null = null;
    private actorServerTiles?: ReadonlyArray<{
        x: number;
        y: number;
        plane: number;
        kind: "player" | "npc";
        serverId: number;
        label: string;
    }>;
    private hoverEnabled: boolean = true;
    // PERF: Cached helper reference to avoid re-lookup
    private cachedSampleHeightFn?: (x: number, y: number, plane: number) => number;
    private cachedEffectivePlaneFn?: (x: number, y: number, basePlane: number) => number;

    // PERF: Cached arrays to avoid per-frame allocations
    private cachedLineData = new Float32Array(5 * 3);
    private cachedFillData = new Float32Array(4 * 3);
    private cachedCorners: [number, number, number][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];

    init(args: OverlayInitArgs): void {
        this.app = args.app;
        this.sceneUniforms = args.sceneUniforms;

        // Hover line
        const initialLine = new Float32Array(5 * 3);
        this.hoverLinePositions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, initialLine);
        this.hoverLineArray = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.hoverLinePositions);
        this.hoverLineDrawCall = this.app
            .createDrawCall(this.program, this.hoverLineArray)
            .uniformBlock("SceneUniforms", this.sceneUniforms!)
            .uniform("u_color", this.hoverColor)
            .primitive(PicoGL.LINE_STRIP);

        // Hover fill
        const initialFill = new Float32Array(4 * 3);
        this.hoverFillPositions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, initialFill);
        this.hoverFillArray = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.hoverFillPositions);
        this.hoverFillDrawCall = this.app
            .createDrawCall(this.program, this.hoverFillArray)
            .uniformBlock("SceneUniforms", this.sceneUniforms!)
            .uniform("u_color", this.hoverFillColor)
            .primitive(PicoGL.TRIANGLE_FAN);

        // Destination overlays
        const initialDestLine = new Float32Array(5 * 3);
        this.destLinePositions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, initialDestLine);
        this.destLineArray = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.destLinePositions);
        this.destLineDrawCall = this.app
            .createDrawCall(this.program, this.destLineArray)
            .uniformBlock("SceneUniforms", this.sceneUniforms!)
            .uniform("u_color", this.destColor)
            .primitive(PicoGL.LINE_STRIP);

        const initialDestFill = new Float32Array(4 * 3);
        this.destFillPositions = this.app.createVertexBuffer(PicoGL.FLOAT, 3, initialDestFill);
        this.destFillArray = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.destFillPositions);
        this.destFillDrawCall = this.app
            .createDrawCall(this.program, this.destFillArray)
            .uniformBlock("SceneUniforms", this.sceneUniforms!)
            .uniform("u_color", this.destFillColor)
            .primitive(PicoGL.TRIANGLE_FAN);

        // Current true tile outline
        const initialCurrentLine = new Float32Array(5 * 3);
        this.currentLinePositions = this.app.createVertexBuffer(
            PicoGL.FLOAT,
            3,
            initialCurrentLine,
        );
        this.currentLineArray = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.currentLinePositions);
        this.currentLineDrawCall = this.app
            .createDrawCall(this.program, this.currentLineArray)
            .uniformBlock("SceneUniforms", this.sceneUniforms!)
            .uniform("u_color", this.currentColor)
            .primitive(PicoGL.LINE_STRIP);
    }

    setDestinationColor(colorRgb: number): void {
        this.setColorFromRgb(this.destColor, colorRgb, 1.0);
        this.setColorFromRgb(this.destFillColor, colorRgb, 0.2);
    }

    setCurrentTileColor(colorRgb: number): void {
        this.setColorFromRgb(this.currentColor, colorRgb, 1.0);
    }

    update(args: OverlayUpdateArgs): void {
        this.hoverEnabled = !!args.state.hoverEnabled;
        // PERF: Cache the height function reference once
        // Use bridge-aware sampling so markers stay on the visible surface while on bridges.
        this.cachedSampleHeightFn = args.helpers.getTileHeightAtPlane;
        this.cachedEffectivePlaneFn = args.helpers.getEffectivePlaneForTile;
        this.actorServerTiles = args.state.actorServerTiles;
        this.tileHighlights = args.state.tileHighlights;

        // Hover - update data in-place to avoid allocation
        if (args.state.hoverTile) {
            const { x, y } = args.state.hoverTile;
            const basePlane = (args.state.playerRawLevel ?? args.state.playerLevel) | 0;
            const eff = args.helpers.getEffectivePlaneForTile(x, y, basePlane);
            if (!this.hoverTileData) {
                this.hoverTileData = { x, y, effPlane: eff };
            } else {
                this.hoverTileData.x = x;
                this.hoverTileData.y = y;
                this.hoverTileData.effPlane = eff;
            }
        } else {
            this.hoverTileData = null;
        }

        // Destination - update data in-place to avoid allocation
        if (args.state.destTile) {
            const { x, y } = args.state.destTile;
            const basePlane = (args.state.playerRawLevel ?? args.state.playerLevel) | 0;
            const eff = args.helpers.getEffectivePlaneForTile(x, y, basePlane);
            if (!this.destTileData) {
                this.destTileData = { x, y, effPlane: eff };
            } else {
                this.destTileData.x = x;
                this.destTileData.y = y;
                this.destTileData.effPlane = eff;
            }
        } else {
            this.destTileData = null;
        }

        // Current true tile - update data in-place to avoid allocation
        if (args.state.currentTile) {
            const { x, y } = args.state.currentTile;
            const basePlane =
                (args.state.currentTile.plane ??
                    args.state.playerRawLevel ??
                    args.state.playerLevel) | 0;
            const eff = args.helpers.getEffectivePlaneForTile(x, y, basePlane);
            if (!this.currentTileData) {
                this.currentTileData = { x, y, effPlane: eff };
            } else {
                this.currentTileData.x = x;
                this.currentTileData.y = y;
                this.currentTileData.effPlane = eff;
            }
        } else {
            this.currentTileData = null;
        }
    }

    draw(phase: RenderPhase): void {
        if (!this.app) return;
        const sampleHeight = this.cachedSampleHeightFn;
        if (!sampleHeight) return;
        const getEffectivePlaneForTile = this.cachedEffectivePlaneFn;
        if (!getEffectivePlaneForTile) return;

        if (phase === RenderPhase.ToSceneFramebuffer) {
            this.drawDepthAwareTiles(sampleHeight, getEffectivePlaneForTile);
            return;
        }
        if (phase !== RenderPhase.PostPresent) return;

        // Actor server tiles (non-interpolated server positions)
        if (this.hoverEnabled && this.actorServerTiles && this.actorServerTiles.length > 0) {
            this.app.defaultDrawFramebuffer();
            this.app.disable(PicoGL.DEPTH_TEST);
            this.app.disable(PicoGL.CULL_FACE as any);
            this.app.disable(PicoGL.BLEND);

            for (const t of this.actorServerTiles) {
                const tileX = t.x | 0;
                const tileY = t.y | 0;
                const basePlane = t.plane | 0;
                const effPlane = getEffectivePlaneForTile(tileX, tileY, basePlane) | 0;
                this.updateQuadBuffersWithPlane(
                    this.hoverLinePositions!,
                    this.hoverFillPositions!,
                    sampleHeight,
                    effPlane,
                    tileX,
                    tileY,
                );
                this.hoverLineDrawCall!.uniform("u_color", this.serverTileColor)
                    .primitive(PicoGL.LINE_STRIP)
                    .draw();
            }
        }

        if (this.tileHighlights && this.tileHighlights.length > 0) {
            this.app.defaultDrawFramebuffer();
            this.app.disable(PicoGL.DEPTH_TEST);
            this.app.disable(PicoGL.CULL_FACE as any);
            for (let i = 0; i < this.tileHighlights.length; i++) {
                const highlight = this.tileHighlights[i];
                if (!highlight || !highlight.alwaysOnTop) {
                    continue;
                }
                const effPlane = getEffectivePlaneForTile(
                    highlight.x,
                    highlight.y,
                    highlight.plane,
                );
                this.drawTileHighlight(
                    sampleHeight,
                    effPlane,
                    highlight.x,
                    highlight.y,
                    highlight.colorRgb,
                    highlight.fillAlpha,
                );
            }
        }
    }

    private drawDepthAwareTiles(
        sampleHeight: (x: number, y: number, plane: number) => number,
        getEffectivePlaneForTile: (x: number, y: number, basePlane: number) => number,
    ): void {
        this.app!.enable(PicoGL.DEPTH_TEST);
        this.app!.depthMask(false);
        this.app!.disable(PicoGL.CULL_FACE as any);

        if (this.hoverEnabled && this.hoverTileData) {
            const { x: tileX, y: tileY, effPlane } = this.hoverTileData;
            this.updateQuadBuffersWithPlane(
                this.hoverLinePositions!,
                this.hoverFillPositions!,
                sampleHeight,
                effPlane,
                tileX,
                tileY,
            );
            this.drawQuad(
                this.hoverFillDrawCall!,
                this.hoverFillColor,
                this.hoverLineDrawCall!,
                this.hoverColor,
            );
        }

        if (this.destTileData) {
            const { x: tileX, y: tileY, effPlane } = this.destTileData;
            this.updateQuadBuffersWithPlane(
                this.destLinePositions!,
                this.destFillPositions!,
                sampleHeight,
                effPlane,
                tileX,
                tileY,
            );
            this.drawQuad(
                this.destFillDrawCall!,
                this.destFillColor,
                this.destLineDrawCall!,
                this.destColor,
            );
        }

        if (this.currentTileData) {
            const { x: tileX, y: tileY, effPlane } = this.currentTileData;
            this.updateLineBufferWithPlane(
                this.currentLinePositions!,
                sampleHeight,
                effPlane,
                tileX,
                tileY,
            );
            this.app!.disable(PicoGL.BLEND);
            this.currentLineDrawCall!.uniform("u_color", this.currentColor)
                .primitive(PicoGL.LINE_STRIP)
                .draw();
        }

        if (this.tileHighlights && this.tileHighlights.length > 0) {
            for (let i = 0; i < this.tileHighlights.length; i++) {
                const highlight = this.tileHighlights[i];
                if (!highlight || highlight.alwaysOnTop) {
                    continue;
                }
                const effPlane = getEffectivePlaneForTile(
                    highlight.x,
                    highlight.y,
                    highlight.plane,
                );
                this.drawTileHighlight(
                    sampleHeight,
                    effPlane,
                    highlight.x,
                    highlight.y,
                    highlight.colorRgb,
                    highlight.fillAlpha,
                );
            }
        }

        this.app!.depthMask(true);
    }

    private drawQuad(
        fillDrawCall: DrawCall,
        fillColor: vec4,
        lineDrawCall: DrawCall,
        lineColor: vec4,
    ): void {
        this.app!.enable(PicoGL.BLEND);
        fillDrawCall.uniform("u_color", fillColor).primitive(PicoGL.TRIANGLE_FAN).draw();
        this.app!.disable(PicoGL.BLEND);
        lineDrawCall.uniform("u_color", lineColor).primitive(PicoGL.LINE_STRIP).draw();
    }

    dispose(): void {
        this.deleteGpuObject(this.hoverLinePositions);
        this.deleteGpuObject(this.hoverFillPositions);
        this.deleteGpuObject(this.destLinePositions);
        this.deleteGpuObject(this.destFillPositions);
        this.deleteGpuObject(this.currentLinePositions);
        this.deleteGpuObject(this.hoverLineArray);
        this.deleteGpuObject(this.hoverFillArray);
        this.deleteGpuObject(this.destLineArray);
        this.deleteGpuObject(this.destFillArray);
        this.deleteGpuObject(this.currentLineArray);
        this.hoverLinePositions = undefined;
        this.hoverFillPositions = undefined;
        this.destLinePositions = undefined;
        this.destFillPositions = undefined;
        this.currentLinePositions = undefined;
        this.hoverLineArray = undefined;
        this.hoverFillArray = undefined;
        this.destLineArray = undefined;
        this.destFillArray = undefined;
        this.currentLineArray = undefined;
    }

    private deleteGpuObject(resource?: { delete?: () => void }): void {
        resource?.delete?.();
    }

    private drawTileHighlight(
        sampleHeight: (x: number, y: number, plane: number) => number,
        effPlane: number,
        tileX: number,
        tileY: number,
        colorRgb: number,
        fillAlpha: number,
    ): void {
        this.updateQuadBuffersWithPlane(
            this.hoverLinePositions!,
            this.hoverFillPositions!,
            sampleHeight,
            effPlane,
            tileX,
            tileY,
        );
        if (fillAlpha > 0) {
            this.setColorFromRgb(this.scratchFillColor, colorRgb, fillAlpha);
            this.app!.enable(PicoGL.BLEND);
            this.hoverFillDrawCall!.uniform("u_color", this.scratchFillColor)
                .primitive(PicoGL.TRIANGLE_FAN)
                .draw();
            this.app!.disable(PicoGL.BLEND);
        }
        this.setColorFromRgb(this.scratchLineColor, colorRgb, 1.0);
        this.hoverLineDrawCall!.uniform("u_color", this.scratchLineColor)
            .primitive(PicoGL.LINE_STRIP)
            .draw();
    }

    // PERF: Updated method that takes sampleHeight + plane instead of closure
    private updateLineBufferWithPlane(
        lineBuf: VertexBuffer,
        sampleHeight: (x: number, y: number, plane: number) => number,
        effPlane: number,
        tileX: number,
        tileY: number,
    ): void {
        this.updateCorners(sampleHeight, effPlane, tileX, tileY);
        this.updateLineBuffer(lineBuf);
    }

    private updateQuadBuffersWithPlane(
        lineBuf: VertexBuffer,
        fillBuf: VertexBuffer,
        sampleHeight: (x: number, y: number, plane: number) => number,
        effPlane: number,
        tileX: number,
        tileY: number,
    ): void {
        this.updateCorners(sampleHeight, effPlane, tileX, tileY);
        this.updateLineBuffer(lineBuf);
        this.updateFillBuffer(fillBuf);
    }

    private updateCorners(
        sampleHeight: (x: number, y: number, plane: number) => number,
        effPlane: number,
        tileX: number,
        tileY: number,
    ): void {
        // PERF: Update cached corners in-place instead of creating new arrays
        const corners = this.cachedCorners;
        corners[0][0] = tileX;
        corners[0][1] = sampleHeight(tileX, tileY, effPlane);
        corners[0][2] = tileY;
        corners[1][0] = tileX + 1;
        corners[1][1] = sampleHeight(tileX + 1, tileY, effPlane);
        corners[1][2] = tileY;
        corners[2][0] = tileX + 1;
        corners[2][1] = sampleHeight(tileX + 1, tileY + 1, effPlane);
        corners[2][2] = tileY + 1;
        corners[3][0] = tileX;
        corners[3][1] = sampleHeight(tileX, tileY + 1, effPlane);
        corners[3][2] = tileY + 1;
    }

    private updateLineBuffer(lineBuf: VertexBuffer): void {
        const corners = this.cachedCorners;
        const lineData = this.cachedLineData;
        for (let i = 0; i < 4; i++) {
            const c = corners[i];
            lineData[i * 3 + 0] = c[0];
            lineData[i * 3 + 1] = c[1] - 0.02;
            lineData[i * 3 + 2] = c[2];
        }
        lineData[12] = corners[0][0];
        lineData[13] = corners[0][1] - 0.02;
        lineData[14] = corners[0][2];
        lineBuf.data(lineData);
    }

    private updateFillBuffer(fillBuf: VertexBuffer): void {
        const corners = this.cachedCorners;
        const fillData = this.cachedFillData;
        for (let i = 0; i < 4; i++) {
            const c = corners[i];
            fillData[i * 3 + 0] = c[0];
            fillData[i * 3 + 1] = c[1] - 0.015;
            fillData[i * 3 + 2] = c[2];
        }
        fillBuf.data(fillData);
    }

    private setColorFromRgb(out: vec4, colorRgb: number, alpha: number): void {
        const rgb = colorRgb >>> 0;
        out[0] = ((rgb >> 16) & 0xff) / 255.0;
        out[1] = ((rgb >> 8) & 0xff) / 255.0;
        out[2] = (rgb & 0xff) / 255.0;
        out[3] = alpha;
    }
}
