import { describe, expect, test } from "bun:test";

import { describePersistentStorageResult } from "../src/util/StorageUtil";

describe("StorageUtil persistent-storage messaging", () => {
    test("treats denied persistence as informational in normal browser tabs", () => {
        expect(
            describePersistentStorageResult(false, {
                isIos: false,
                isStandalone: false,
            }),
        ).toEqual({
            level: "info",
            consoleMessage:
                "[storage] Persistent storage not granted; cache is still usable but may be evicted by browser policy",
        });
    });

    test("suppresses messaging for effectively persistent iOS standalone installs", () => {
        expect(
            describePersistentStorageResult(false, {
                isIos: true,
                isStandalone: true,
            }),
        ).toBeUndefined();
    });

    test("keeps unsupported storage as a warning with a user-facing hint", () => {
        expect(
            describePersistentStorageResult("unsupported", {
                isIos: false,
                isStandalone: false,
            }),
        ).toEqual({
            level: "warn",
            consoleMessage:
                "[storage] Persistent storage API not available; browser may evict cached data",
            userMessage:
                "Persistent storage not supported in this browser. Cached assets may be cleared. Install as PWA or use a modern browser.",
        });
    });
});
