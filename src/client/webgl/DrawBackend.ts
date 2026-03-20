import PicoGL, { App as PicoApp, DrawCall, Texture } from "picogl";

import type { DrawRange } from "./DrawRange";

export interface DrawBackend {
    readonly supportsMultiDraw: boolean;

    init(app: PicoApp, gl: WebGL2RenderingContext): void;
    configureDrawCall(drawCall: DrawCall): DrawCall;
    draw(drawCall: DrawCall, drawRanges: DrawRange[], drawIndices?: number[]): void;
    dispose(): void;
}

class SingleDrawBackend implements DrawBackend {
    readonly supportsMultiDraw: boolean = false;

    init(_app: PicoApp, _gl: WebGL2RenderingContext): void {}

    configureDrawCall(drawCall: DrawCall): DrawCall {
        return drawCall.uniform("u_drawIdOverride", -1);
    }

    draw(drawCall: DrawCall, drawRanges: DrawRange[], drawIndices?: number[]): void {
        this.configureDrawCall(drawCall);

        if (drawIndices && drawIndices.length > 0) {
            for (let i = 0; i < drawIndices.length; i++) {
                const originalIndex = drawIndices[i] | 0;
                const range = drawRanges[originalIndex];
                if (!range || (range[1] | 0) <= 0 || (range[2] | 0) <= 0) continue;
                drawCall.uniform("u_drawIdOverride", originalIndex);
                (drawCall as any).drawRanges(range);
                drawCall.draw();
            }
        } else {
            for (let i = 0; i < drawRanges.length; i++) {
                const range = drawRanges[i];
                if (!range || (range[1] | 0) <= 0 || (range[2] | 0) <= 0) continue;
                drawCall.uniform("u_drawIdOverride", i);
                (drawCall as any).drawRanges(range);
                drawCall.draw();
            }
        }

        drawCall.uniform("u_drawIdOverride", -1);
    }

    dispose(): void {}
}

class MultiDrawBackend implements DrawBackend {
    readonly supportsMultiDraw: boolean = true;

    private app?: PicoApp;
    private gl?: WebGL2RenderingContext;
    private drawIdRemapData?: Int32Array;
    private drawIdRemapTexture?: Texture;
    private multiDrawOffsets?: Int32Array;
    private multiDrawCounts?: Int32Array;
    private multiDrawInstances?: Int32Array;
    private drawIdRemapCapacity: number = 0;

    init(app: PicoApp, gl: WebGL2RenderingContext): void {
        this.dispose();

        this.app = app;
        this.gl = gl;

        const initialCapacity = 256;
        this.drawIdRemapCapacity = initialCapacity;
        this.drawIdRemapData = new Int32Array(initialCapacity);
        this.multiDrawOffsets = new Int32Array(initialCapacity);
        this.multiDrawCounts = new Int32Array(initialCapacity);
        this.multiDrawInstances = new Int32Array(initialCapacity);

        const texWidth = 16;
        const texHeight = Math.ceil(initialCapacity / texWidth);
        this.drawIdRemapTexture = app.createTexture2D(texWidth, texHeight, {
            internalFormat: PicoGL.R32I,
            type: PicoGL.INT,
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
            wrapS: PicoGL.CLAMP_TO_EDGE,
            wrapT: PicoGL.CLAMP_TO_EDGE,
        });

        for (let i = 0; i < initialCapacity; i++) {
            this.drawIdRemapData[i] = i;
        }

        gl.bindTexture(gl.TEXTURE_2D, (this.drawIdRemapTexture as any).texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            texWidth,
            texHeight,
            gl.RED_INTEGER,
            gl.INT,
            this.drawIdRemapData,
        );
    }

    configureDrawCall(drawCall: DrawCall): DrawCall {
        if (this.drawIdRemapTexture) {
            drawCall.texture("u_drawIdRemap", this.drawIdRemapTexture);
        }
        return drawCall.uniform("u_useDrawIdRemap", false).uniform("u_drawIdOverride", -1);
    }

    draw(drawCall: DrawCall, drawRanges: DrawRange[], drawIndices?: number[]): void {
        this.configureDrawCall(drawCall);

        if (drawIndices && drawIndices.length > 0) {
            this.ensureDrawIdRemap(drawIndices, drawRanges);

            drawCall.uniform("u_useDrawIdRemap", true);
            drawCall.uniform("u_drawIdOverride", -1);

            const originalOffsets = (drawCall as any).offsets;
            const originalCounts = (drawCall as any).numElements;
            const originalInstances = (drawCall as any).numInstances;

            (drawCall as any).offsets = this.multiDrawOffsets;
            (drawCall as any).numElements = this.multiDrawCounts;
            (drawCall as any).numInstances = this.multiDrawInstances;
            (drawCall as any).numDraws = drawIndices.length;

            drawCall.draw();

            (drawCall as any).offsets = originalOffsets;
            (drawCall as any).numElements = originalCounts;
            (drawCall as any).numInstances = originalInstances;
            (drawCall as any).numDraws = drawRanges.length;

            drawCall.uniform("u_useDrawIdRemap", false);
            return;
        }

        drawCall.draw();
    }

    dispose(): void {
        this.drawIdRemapTexture?.delete();
        this.drawIdRemapTexture = undefined;
        this.drawIdRemapData = undefined;
        this.multiDrawOffsets = undefined;
        this.multiDrawCounts = undefined;
        this.multiDrawInstances = undefined;
        this.drawIdRemapCapacity = 0;
        this.app = undefined;
        this.gl = undefined;
    }

    private ensureDrawIdRemap(filteredIndices: number[], drawRanges: DrawRange[]): void {
        const app = this.app;
        const gl = this.gl;
        if (!app || !gl) {
            return;
        }

        if (
            !this.drawIdRemapData ||
            !this.drawIdRemapTexture ||
            !this.multiDrawOffsets ||
            !this.multiDrawCounts ||
            !this.multiDrawInstances
        ) {
            this.init(app, gl);
        }

        if (
            !this.drawIdRemapData ||
            !this.multiDrawOffsets ||
            !this.multiDrawCounts ||
            !this.multiDrawInstances
        ) {
            return;
        }

        if (filteredIndices.length > this.drawIdRemapCapacity) {
            let newCapacity = this.drawIdRemapCapacity;
            while (newCapacity < filteredIndices.length) {
                newCapacity *= 2;
            }

            this.drawIdRemapCapacity = newCapacity;
            this.drawIdRemapData = new Int32Array(newCapacity);
            this.multiDrawOffsets = new Int32Array(newCapacity);
            this.multiDrawCounts = new Int32Array(newCapacity);
            this.multiDrawInstances = new Int32Array(newCapacity);

            this.drawIdRemapTexture?.delete();

            const texWidth = 16;
            const texHeight = Math.ceil(newCapacity / texWidth);
            this.drawIdRemapTexture = app.createTexture2D(texWidth, texHeight, {
                internalFormat: PicoGL.R32I,
                type: PicoGL.INT,
                minFilter: PicoGL.NEAREST,
                magFilter: PicoGL.NEAREST,
                wrapS: PicoGL.CLAMP_TO_EDGE,
                wrapT: PicoGL.CLAMP_TO_EDGE,
            });
        }

        for (let i = 0; i < filteredIndices.length; i++) {
            const originalIndex = filteredIndices[i];
            this.drawIdRemapData[i] = originalIndex;

            const range = drawRanges[originalIndex];
            this.multiDrawOffsets![i] = range?.[0] ?? 0;
            this.multiDrawCounts![i] = range?.[1] ?? 0;
            this.multiDrawInstances![i] = range?.[2] ?? 1;
        }

        if (this.drawIdRemapTexture) {
            const texWidth = 16;
            const texHeight = Math.ceil(this.drawIdRemapCapacity / texWidth);
            gl.bindTexture(gl.TEXTURE_2D, (this.drawIdRemapTexture as any).texture);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                0,
                texWidth,
                texHeight,
                gl.RED_INTEGER,
                gl.INT,
                this.drawIdRemapData,
            );
        }
    }
}

export function createDrawBackend(supportsMultiDraw: boolean): DrawBackend {
    return supportsMultiDraw ? new MultiDrawBackend() : new SingleDrawBackend();
}
