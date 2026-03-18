/**
 * MinimapRenderer - WebGL-based minimap rendering
 *
 * Renders the minimap entirely on the GPU with:
 * - Rotation transform in vertex shader
 * - Circular clipping in fragment shader
 * - Batched sprite rendering for dots
 */
import { createProgram } from "./gl-utils";

// Vertex shader for minimap tiles and sprites
// Applies rotation around the minimap center
const VS_MINIMAP = `#version 300 es
precision highp float;

layout(location=0) in vec2 aPos;      // Position relative to minimap center (pre-rotation)
layout(location=1) in vec2 aUV;       // Texture coordinates

uniform mat4 uProj;                   // Orthographic projection
uniform vec2 uCenter;                 // Minimap center on screen
uniform float uSin;                   // sin(rotation angle)
uniform float uCos;                   // cos(rotation angle)
uniform float uZoom;                  // Zoom scale factor

out vec2 vUV;
out vec2 vScreenPos;

void main() {
    // Apply rotation around origin (minimap-relative coords)
    vec2 rotated;
    rotated.x = aPos.x * uCos - aPos.y * uSin;
    rotated.y = aPos.x * uSin + aPos.y * uCos;

    // Scale by zoom and translate to screen position
    vec2 screenPos = uCenter + rotated * uZoom;

    vUV = aUV;
    vScreenPos = screenPos;
    gl_Position = uProj * vec4(screenPos, 0.0, 1.0);
}`;

// Fragment shader with circular clipping
const FS_MINIMAP = `#version 300 es
precision highp float;

in vec2 vUV;
in vec2 vScreenPos;

uniform sampler2D uTexture;
uniform vec2 uCenter;                 // Minimap center on screen
uniform float uRadius;                // Circular clip radius
uniform float uAlpha;                 // Overall alpha

out vec4 fragColor;

void main() {
    // Circular clipping
    float dist = length(vScreenPos - uCenter);
    if (dist > uRadius) {
        discard;
    }

    // Soft edge (anti-aliasing)
    float edge = smoothstep(uRadius, uRadius - 1.5, dist);

    vec4 color = texture(uTexture, vUV);
    color.a *= uAlpha * edge;
    fragColor = color;
}`;

// Vertex shader for unrotated elements (flag, player marker)
// These stay upright regardless of map rotation
const VS_OVERLAY = `#version 300 es
precision highp float;

layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;

uniform mat4 uProj;

out vec2 vUV;
out vec2 vScreenPos;

void main() {
    vUV = aUV;
    vScreenPos = aPos;
    gl_Position = uProj * vec4(aPos, 0.0, 1.0);
}`;

// Fragment shader for overlay (with circular clipping)
const FS_OVERLAY = `#version 300 es
precision highp float;

in vec2 vUV;
in vec2 vScreenPos;

uniform sampler2D uTexture;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAlpha;

out vec4 fragColor;

void main() {
    float dist = length(vScreenPos - uCenter);
    if (dist > uRadius) {
        discard;
    }

    vec4 color = texture(uTexture, vUV);
    color.a *= uAlpha;
    fragColor = color;
}`;

// Solid color shader for player marker
const VS_SOLID = `#version 300 es
precision highp float;

layout(location=0) in vec2 aPos;

uniform mat4 uProj;

out vec2 vScreenPos;

void main() {
    vScreenPos = aPos;
    gl_Position = uProj * vec4(aPos, 0.0, 1.0);
}`;

const FS_SOLID = `#version 300 es
precision highp float;

in vec2 vScreenPos;

uniform vec4 uColor;
uniform vec2 uCenter;
uniform float uRadius;

out vec4 fragColor;

void main() {
    float dist = length(vScreenPos - uCenter);
    if (dist > uRadius) {
        discard;
    }
    fragColor = uColor;
}`;

export interface MinimapTexture {
    tex: WebGLTexture;
    w: number;
    h: number;
}

interface DotInstance {
    x: number; // Position relative to player (in pixels, pre-rotation)
    y: number;
    tex: MinimapTexture;
}

export class MinimapRenderer {
    private gl: WebGL2RenderingContext;
    private proj: Float32Array;

    // Shader programs
    private progMinimap!: WebGLProgram;
    private progOverlay!: WebGLProgram;
    private progSolid!: WebGLProgram;

    // Uniform locations - Minimap
    private uProj_mm!: WebGLUniformLocation;
    private uCenter_mm!: WebGLUniformLocation;
    private uSin_mm!: WebGLUniformLocation;
    private uCos_mm!: WebGLUniformLocation;
    private uZoom_mm!: WebGLUniformLocation;
    private uTexture_mm!: WebGLUniformLocation;
    private uRadius_mm!: WebGLUniformLocation;
    private uAlpha_mm!: WebGLUniformLocation;

    // Uniform locations - Overlay
    private uProj_ov!: WebGLUniformLocation;
    private uCenter_ov!: WebGLUniformLocation;
    private uRadius_ov!: WebGLUniformLocation;
    private uTexture_ov!: WebGLUniformLocation;
    private uAlpha_ov!: WebGLUniformLocation;

    // Uniform locations - Solid
    private uProj_solid!: WebGLUniformLocation;
    private uCenter_solid!: WebGLUniformLocation;
    private uRadius_solid!: WebGLUniformLocation;
    private uColor_solid!: WebGLUniformLocation;

    // Buffers
    private vbo!: WebGLBuffer;
    private ibo!: WebGLBuffer;
    private vao!: WebGLVertexArrayObject;

    // Batching for dots
    private dotBuffer: Float32Array;
    private dotInstances: DotInstance[] = [];
    private maxDots = 256;

    // Current state
    private centerX = 0;
    private centerY = 0;
    private radius = 76;
    private sin = 0;
    private cos = 1;
    private zoom = 1;

    constructor(gl: WebGL2RenderingContext, proj: Float32Array) {
        this.gl = gl;
        this.proj = proj;
        this.dotBuffer = new Float32Array(this.maxDots * 4 * 4); // 4 verts * 4 floats per dot
        this.init();
    }

    private init() {
        const gl = this.gl;

        // Create programs
        this.progMinimap = createProgram(gl, VS_MINIMAP, FS_MINIMAP);
        this.progOverlay = createProgram(gl, VS_OVERLAY, FS_OVERLAY);
        this.progSolid = createProgram(gl, VS_SOLID, FS_SOLID);

        // Get uniform locations - Minimap
        this.uProj_mm = gl.getUniformLocation(this.progMinimap, "uProj")!;
        this.uCenter_mm = gl.getUniformLocation(this.progMinimap, "uCenter")!;
        this.uSin_mm = gl.getUniformLocation(this.progMinimap, "uSin")!;
        this.uCos_mm = gl.getUniformLocation(this.progMinimap, "uCos")!;
        this.uZoom_mm = gl.getUniformLocation(this.progMinimap, "uZoom")!;
        this.uTexture_mm = gl.getUniformLocation(this.progMinimap, "uTexture")!;
        this.uRadius_mm = gl.getUniformLocation(this.progMinimap, "uRadius")!;
        this.uAlpha_mm = gl.getUniformLocation(this.progMinimap, "uAlpha")!;

        // Get uniform locations - Overlay
        this.uProj_ov = gl.getUniformLocation(this.progOverlay, "uProj")!;
        this.uCenter_ov = gl.getUniformLocation(this.progOverlay, "uCenter")!;
        this.uRadius_ov = gl.getUniformLocation(this.progOverlay, "uRadius")!;
        this.uTexture_ov = gl.getUniformLocation(this.progOverlay, "uTexture")!;
        this.uAlpha_ov = gl.getUniformLocation(this.progOverlay, "uAlpha")!;

        // Get uniform locations - Solid
        this.uProj_solid = gl.getUniformLocation(this.progSolid, "uProj")!;
        this.uCenter_solid = gl.getUniformLocation(this.progSolid, "uCenter")!;
        this.uRadius_solid = gl.getUniformLocation(this.progSolid, "uRadius")!;
        this.uColor_solid = gl.getUniformLocation(this.progSolid, "uColor")!;

        // Create buffers
        this.vbo = gl.createBuffer()!;
        this.ibo = gl.createBuffer()!;

        // Index buffer for quad
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        // VAO setup
        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        // aPos (location=0): 2 floats
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        // aUV (location=1): 2 floats
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        gl.bindVertexArray(null);
    }

    /**
     * Update projection matrix (call when screen resizes)
     */
    updateProj(proj: Float32Array) {
        this.proj = proj;
    }

    /**
     * Begin rendering a frame - set up minimap parameters
     */
    begin(centerX: number, centerY: number, radius: number, cameraYaw: number, zoom: number) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
        this.zoom = zoom;

        // OSRS: angle / 326.11 = radians, negative for minimap rotation
        const radians = -cameraYaw / 326.11;
        this.sin = Math.sin(radians);
        this.cos = Math.cos(radians);

        this.dotInstances.length = 0;
    }

    /**
     * Draw a map tile texture
     * @param tex Map tile texture
     * @param relX Tile position relative to player center (in minimap pixels)
     * @param relY Tile position relative to player center (in minimap pixels)
     * @param size Tile size in minimap pixels
     */
    drawTile(tex: MinimapTexture, relX: number, relY: number, size: number) {
        const gl = this.gl;

        gl.useProgram(this.progMinimap);
        gl.uniformMatrix4fv(this.uProj_mm, false, this.proj);
        gl.uniform2f(this.uCenter_mm, this.centerX, this.centerY);
        gl.uniform1f(this.uSin_mm, this.sin);
        gl.uniform1f(this.uCos_mm, this.cos);
        gl.uniform1f(this.uZoom_mm, this.zoom);
        gl.uniform1f(this.uRadius_mm, this.radius);
        gl.uniform1f(this.uAlpha_mm, 1.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex.tex);
        gl.uniform1i(this.uTexture_mm, 0);

        // Quad vertices: position relative to minimap center + UV
        const x0 = relX;
        const y0 = relY;
        const x1 = relX + size;
        const y1 = relY + size;

        const verts = new Float32Array([
            x0,
            y0,
            0,
            0, // top-left
            x1,
            y0,
            1,
            0, // top-right
            x1,
            y1,
            1,
            1, // bottom-right
            x0,
            y1,
            0,
            1, // bottom-left
        ]);

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Queue a dot sprite for batched drawing
     */
    queueDot(tex: MinimapTexture, relX: number, relY: number) {
        this.dotInstances.push({ x: relX, y: relY, tex });
    }

    /**
     * Flush all queued dots - draws them batched by texture
     */
    flushDots() {
        if (this.dotInstances.length === 0) return;

        const gl = this.gl;

        gl.useProgram(this.progMinimap);
        gl.uniformMatrix4fv(this.uProj_mm, false, this.proj);
        gl.uniform2f(this.uCenter_mm, this.centerX, this.centerY);
        gl.uniform1f(this.uSin_mm, this.sin);
        gl.uniform1f(this.uCos_mm, this.cos);
        gl.uniform1f(this.uZoom_mm, this.zoom);
        gl.uniform1f(this.uRadius_mm, this.radius);
        gl.uniform1f(this.uAlpha_mm, 1.0);

        gl.bindVertexArray(this.vao);

        // Group dots by texture for batching
        const byTex = new Map<WebGLTexture, DotInstance[]>();
        for (const dot of this.dotInstances) {
            const arr = byTex.get(dot.tex.tex);
            if (arr) {
                arr.push(dot);
            } else {
                byTex.set(dot.tex.tex, [dot]);
            }
        }

        // Draw each texture batch
        for (const [texId, dots] of byTex) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texId);
            gl.uniform1i(this.uTexture_mm, 0);

            // Get sprite size from first dot
            const spriteW = dots[0].tex.w;
            const spriteH = dots[0].tex.h;
            const halfW = spriteW / 2;
            const halfH = spriteH / 2;

            // Draw each dot individually (could batch further with instancing)
            for (const dot of dots) {
                const x0 = dot.x - halfW;
                const y0 = dot.y - halfH;
                const x1 = dot.x + halfW;
                const y1 = dot.y + halfH;

                const verts = new Float32Array([
                    x0,
                    y0,
                    0,
                    0,
                    x1,
                    y0,
                    1,
                    0,
                    x1,
                    y1,
                    1,
                    1,
                    x0,
                    y1,
                    0,
                    1,
                ]);

                gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
                gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
                gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
            }
        }

        this.dotInstances.length = 0;
    }

    /**
     * Draw an overlay element (unrotated, stays upright)
     * Position is given in rotated minimap coordinates
     */
    drawOverlay(
        tex: MinimapTexture,
        screenX: number,
        screenY: number,
        width?: number,
        height?: number,
    ) {
        const gl = this.gl;
        const w = width ?? tex.w;
        const h = height ?? tex.h;

        gl.useProgram(this.progOverlay);
        gl.uniformMatrix4fv(this.uProj_ov, false, this.proj);
        gl.uniform2f(this.uCenter_ov, this.centerX, this.centerY);
        gl.uniform1f(this.uRadius_ov, this.radius);
        gl.uniform1f(this.uAlpha_ov, 1.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex.tex);
        gl.uniform1i(this.uTexture_ov, 0);

        const x0 = screenX - w / 2;
        const y0 = screenY - h / 2;
        const x1 = screenX + w / 2;
        const y1 = screenY + h / 2;

        const verts = new Float32Array([x0, y0, 0, 0, x1, y0, 1, 0, x1, y1, 1, 1, x0, y1, 0, 1]);

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Draw a solid colored rectangle (for player marker)
     */
    drawSolidRect(
        screenX: number,
        screenY: number,
        width: number,
        height: number,
        color: [number, number, number, number],
    ) {
        const gl = this.gl;

        gl.useProgram(this.progSolid);
        gl.uniformMatrix4fv(this.uProj_solid, false, this.proj);
        gl.uniform2f(this.uCenter_solid, this.centerX, this.centerY);
        gl.uniform1f(this.uRadius_solid, this.radius);
        gl.uniform4fv(this.uColor_solid, color);

        const x0 = screenX - width / 2;
        const y0 = screenY - height / 2;
        const x1 = screenX + width / 2;
        const y1 = screenY + height / 2;

        // For solid shader, we only need position (no UV)
        // But VAO expects 16 bytes stride, so pad with zeros
        const verts = new Float32Array([x0, y0, 0, 0, x1, y0, 0, 0, x1, y1, 0, 0, x0, y1, 0, 0]);

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Transform a relative position to screen position (applying rotation and zoom)
     * Used for positioning overlay elements like the flag
     */
    relativeToScreen(relX: number, relY: number): { x: number; y: number } {
        // Apply rotation
        const rotX = relX * this.cos - relY * this.sin;
        const rotY = relX * this.sin + relY * this.cos;

        // Apply zoom and translate to screen
        return {
            x: this.centerX + rotX * this.zoom,
            y: this.centerY + rotY * this.zoom,
        };
    }

    /**
     * Get current minimap center
     */
    getCenter(): { x: number; y: number } {
        return { x: this.centerX, y: this.centerY };
    }

    /**
     * Get current minimap radius
     */
    getRadius(): number {
        return this.radius;
    }
}
