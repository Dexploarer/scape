import { describe, expect, test } from "bun:test";

import { resolveWidgetsOverlayInitRefs } from "../src/client/webgl/widgetsOverlayInitState";

describe("resolveWidgetsOverlayInitRefs", () => {
    test("returns stable refs only when both overlay manager and scene uniforms exist", () => {
        const overlayManager = { add() {} };
        const sceneUniformBuffer = { update() {} };

        expect(
            resolveWidgetsOverlayInitRefs({
                overlayManager: overlayManager as never,
                sceneUniformBuffer,
            }),
        ).toEqual({
            overlayManager,
            sceneUniformBuffer,
        });
    });

    test("returns undefined when cleanup has already cleared runtime refs", () => {
        expect(
            resolveWidgetsOverlayInitRefs({
                overlayManager: undefined,
                sceneUniformBuffer: { update() {} },
            }),
        ).toBeUndefined();
        expect(
            resolveWidgetsOverlayInitRefs({
                overlayManager: { add() {} } as never,
                sceneUniformBuffer: undefined,
            }),
        ).toBeUndefined();
    });
});
