import { DIRECTION_TO_ORIENTATION, MovementDirection, directionToOrientation } from "../Direction";

describe("directionToOrientation", () => {
    test("matches the OSRS orientationAnglesByDirection table", () => {
        expect(DIRECTION_TO_ORIENTATION).toEqual([768, 1024, 1280, 512, 1536, 256, 0, 1792]);

        expect(directionToOrientation(MovementDirection.SouthWest)).toBe(768);
        expect(directionToOrientation(MovementDirection.South)).toBe(1024);
        expect(directionToOrientation(MovementDirection.SouthEast)).toBe(1280);
        expect(directionToOrientation(MovementDirection.West)).toBe(512);
        expect(directionToOrientation(MovementDirection.East)).toBe(1536);
        expect(directionToOrientation(MovementDirection.NorthWest)).toBe(256);
        expect(directionToOrientation(MovementDirection.North)).toBe(0);
        expect(directionToOrientation(MovementDirection.NorthEast)).toBe(1792);
    });
});
