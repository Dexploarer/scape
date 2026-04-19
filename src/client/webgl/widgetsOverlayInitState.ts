import type { OverlayManager } from "../../ui/devoverlay/OverlayManager";

export type WidgetsOverlayInitRefs<TSceneUniforms = unknown> = {
    overlayManager?: OverlayManager;
    sceneUniformBuffer?: TSceneUniforms;
};

export type ResolvedWidgetsOverlayInitRefs<TSceneUniforms = unknown> = {
    overlayManager: OverlayManager;
    sceneUniformBuffer: TSceneUniforms;
};

export function resolveWidgetsOverlayInitRefs<TSceneUniforms = unknown>(
    refs: WidgetsOverlayInitRefs<TSceneUniforms>,
): ResolvedWidgetsOverlayInitRefs<TSceneUniforms> | undefined {
    const overlayManager = refs.overlayManager;
    const sceneUniformBuffer = refs.sceneUniformBuffer;
    if (!overlayManager || !sceneUniformBuffer) {
        return undefined;
    }
    return {
        overlayManager,
        sceneUniformBuffer,
    };
}
