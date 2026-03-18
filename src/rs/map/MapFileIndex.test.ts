import { getMapIndexFromTile } from "./MapFileIndex";

describe("getMapIndexFromTile", () => {
    it("floors tile coordinates into map indices for positive values", () => {
        expect(getMapIndexFromTile(0)).toBe(0);
        expect(getMapIndexFromTile(63)).toBe(0);
        expect(getMapIndexFromTile(64)).toBe(1);
        expect(getMapIndexFromTile(127)).toBe(1);
    });

    it("floors tile coordinates for negative values instead of truncating", () => {
        expect(getMapIndexFromTile(-1)).toBe(-1);
        expect(getMapIndexFromTile(-64)).toBe(-1);
        expect(getMapIndexFromTile(-65)).toBe(-2);
        expect(getMapIndexFromTile(-128)).toBe(-2);
    });
});
