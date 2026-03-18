import { deriveMenuEntriesForWidget, findBlockingWidgetInHits } from "../utils";

describe("deriveMenuEntriesForWidget (item widgets)", () => {
    test("inserts targetVerb (Use) after primary item action", () => {
        const w = {
            itemId: 1381,
            name: "Staff of air",
            targetVerb: "Use",
            actions: [null, "Wield", null, null, "Drop"],
        };
        const entries = deriveMenuEntriesForWidget(w);
        expect(entries.map((e) => e.option)).toEqual(["Wield", "Use", "Drop", "Examine", "Cancel"]);
        expect(entries[0].target).toBe("<col=ff9040>Staff of air");
    });

    test("keeps targetVerb (Use) first when there is no primary item action", () => {
        const w = {
            itemId: 995,
            name: "Coins",
            targetVerb: "Use",
            actions: [null, null, null, null, "Drop"],
        };
        const entries = deriveMenuEntriesForWidget(w);
        expect(entries.map((e) => e.option)).toEqual(["Use", "Drop", "Examine", "Cancel"]);
    });
});

describe("deriveMenuEntriesForWidget (spell widgets)", () => {
    test("uses spellActionName when targetVerb is missing", () => {
        const w = {
            spellActionName: "Cast",
            flags: 1 << 11,
            opBase: "<col=00ff00>Wind Strike</col>",
            actions: [],
        };
        const entries = deriveMenuEntriesForWidget(w);
        expect(entries.map((e) => e.option)).toEqual(["Cast", "Cancel"]);
        expect(entries[0].target).toBe("<col=00ff00>Wind Strike</col>");
    });

    test("keeps spellActionName available when actions array exists but has no active ops", () => {
        const w = {
            spellActionName: "Cast",
            flags: 1 << 11,
            opBase: "<col=00ff00>Wind Strike</col>",
            actions: [null, null, null, null, null],
        };
        const entries = deriveMenuEntriesForWidget(w);
        expect(entries.map((e) => e.option)).toEqual(["Cast", "Cancel"]);
    });
});

describe("findBlockingWidgetInHits", () => {
    test("ignores listener widgets without any click-capture traits", () => {
        const hits = [
            { uid: 1, type: 0 },
            { uid: 2, type: 4 },
        ];

        expect(findBlockingWidgetInHits(hits)).toBeNull();
    });

    test("returns noClickThrough container before children above it", () => {
        const blocker = { uid: 2, type: 0, noClickThrough: true };
        const hits = [{ uid: 1, type: 0 }, blocker, { uid: 3, type: 4 }];

        expect(findBlockingWidgetInHits(hits)).toBe(blocker);
    });

    test("treats modal input-capture containers as blockers", () => {
        const blocker = { uid: 2, type: 0 };
        const hits = [{ uid: 1, type: 0 }, blocker];

        expect(
            findBlockingWidgetInHits(hits, {
                isInputCaptureWidget: (uid) => uid === 2,
            }),
        ).toBe(blocker);
    });

    test("treats transmit-op widgets as blockers", () => {
        const blocker = { uid: 2, type: 4 };
        const hits = [{ uid: 1, type: 0 }, blocker];

        expect(
            findBlockingWidgetInHits(hits, {
                getWidgetFlags: (widget) => (((widget?.uid ?? 0) | 0) === 2 ? 2 : 0),
            }),
        ).toBe(blocker);
    });
});
