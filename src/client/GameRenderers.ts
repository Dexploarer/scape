import { GameRenderer } from "./GameRenderer";
import { OsrsClient } from "./OsrsClient";
import { WebGLOsrsRenderer } from "./webgl/WebGLOsrsRenderer";

export type OsrsRendererType = "webgl";
export const WEBGL: OsrsRendererType = "webgl";

export function getRendererName(type: OsrsRendererType): string {
    switch (type) {
        case WEBGL:
            return "WebGL";
        default:
            throw new Error("Unknown renderer type");
    }
}

export function createRenderer(type: OsrsRendererType, osrsClient: OsrsClient): GameRenderer {
    switch (type) {
        case WEBGL:
            return new WebGLOsrsRenderer(osrsClient);
        default:
            throw new Error("Unknown renderer type");
    }
}

export function getAvailableRenderers(): OsrsRendererType[] {
    const renderers: OsrsRendererType[] = [];

    if (WebGLOsrsRenderer.isSupported()) {
        renderers.push(WEBGL);
    }

    return renderers;
}
