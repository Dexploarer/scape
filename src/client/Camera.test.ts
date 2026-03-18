import { vec4 } from "gl-matrix";

import { Camera } from "./Camera";

describe("Camera viewport mapping", () => {
    test("maps raw script pitch into OSRS scene pitch angles", () => {
        expect(Camera.rawPitchToScenePitchAngle(0)).toBe(128);
        expect(Camera.rawPitchToScenePitchAngle(256)).toBe(255);
        expect(Camera.rawPitchToScenePitchAngle(512)).toBe(383);
    });

    test("projects the view center into the viewport widget center", () => {
        const camera = new Camera(0, 0, 0, 0, 0);

        camera.update(1600, 900, 200, 100, 800, 600);

        const clip = vec4.create();
        vec4.transformMat4(clip, vec4.fromValues(0, 0, -1, 1), camera.projectionMatrix);

        const ndcX = clip[0] / clip[3];
        const ndcY = clip[1] / clip[3];
        const screenX = (ndcX + 1) * 0.5 * camera.screenWidth;
        const screenY = (1 - (ndcY + 1) * 0.5) * camera.screenHeight;

        expect(Math.round(screenX)).toBe(600);
        expect(Math.round(screenY)).toBe(400);
        expect(camera.viewportXOffset).toBe(200);
        expect(camera.viewportYOffset).toBe(100);
        expect(camera.viewportWidth).toBe(800);
        expect(camera.viewportHeight).toBe(600);
    });

    test("containsScreenPoint matches the effective scene viewport", () => {
        const camera = new Camera(0, 0, 0, 0, 0);

        camera.update(1600, 900, 200, 100, 800, 600);

        expect(camera.containsScreenPoint(200, 100)).toBe(true);
        expect(camera.containsScreenPoint(999, 699)).toBe(true);
        expect(camera.containsScreenPoint(199, 100)).toBe(false);
        expect(camera.containsScreenPoint(1000, 699)).toBe(false);
        expect(camera.containsScreenPoint(999, 700)).toBe(false);
    });
});
