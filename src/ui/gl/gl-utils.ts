export function createGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
    const gl =
        (canvas.getContext("webgl2", {
            alpha: true,
            antialias: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
        }) as WebGL2RenderingContext) || null;
    return gl;
}

export function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) || "";
        gl.deleteShader(sh);
        throw new Error("Shader compile failed: " + log);
    }
    return sh;
}

export function createProgram(
    gl: WebGL2RenderingContext,
    vsSrc: string,
    fsSrc: string,
): WebGLProgram {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog) || "";
        gl.deleteProgram(prog);
        throw new Error("Program link failed: " + log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
}
