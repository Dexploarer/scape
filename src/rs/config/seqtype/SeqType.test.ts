import { SeqType } from "./SeqType";

describe("SeqType frame lengths (dat2 / OSRS)", () => {
    test("regression: frameLength falls back to SeqFrameLoader when frameLengths are 0", () => {
        // Repro for invisible/near-instant one-shot animations when frameLengths are zeros
        // in the cache; without the fallback, many sequences advance at 1 tick per frame.
        const cacheInfo = {
            name: "test",
            game: "oldschool" as const,
            environment: "live",
            revision: 235,
            timestamp: new Date(0).toISOString(),
            size: 0,
        };
        const seq = new SeqType(879, cacheInfo);
        seq.frameIds = [0x00010001, 0x00010002, 0x00010003];
        seq.frameLengths = [0, 0, 0];

        const seqFrameLoader = {
            load: (_id: number) => ({ frameLength: 5 }),
            clearCache: () => {},
        } as any;

        expect(seq.getFrameLength(seqFrameLoader, 0)).toBe(5);
        expect(seq.getFrameLength(seqFrameLoader, 1)).toBe(5);
        expect(seq.getFrameLength(seqFrameLoader, 2)).toBe(5);
    });
});
