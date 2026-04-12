import { describe, expect, test } from "bun:test";

import {
    isExtensionRuntimeErrorCandidate,
    shouldSuppressUnhandledRejectionEvent,
    shouldSuppressWindowErrorEvent,
} from "../src/util/ExtensionRuntimeErrors";

describe("ExtensionRuntimeErrors", () => {
    test("detects extension-origin errors from filename and stack text", () => {
        expect(
            isExtensionRuntimeErrorCandidate({
                filename: "chrome-extension://abc123/inpage.js",
            }),
        ).toBe(true);

        expect(
            isExtensionRuntimeErrorCandidate({
                error: {
                    stack: "TypeError\n    at x (chrome-extension://abc123/inpage.js:1:2)",
                },
            }),
        ).toBe(true);
    });

    test("does not suppress normal app/runtime errors", () => {
        expect(
            isExtensionRuntimeErrorCandidate({
                filename: "https://scape-client.example/static/js/main.js",
                message: "boom",
            }),
        ).toBe(false);
    });

    test("suppresses error and rejection events only for extension-origin failures", () => {
        expect(
            shouldSuppressWindowErrorEvent({
                filename: "chrome-extension://wallet/inpage.js",
                message: "Cannot read from private field",
                error: undefined,
            }),
        ).toBe(true);

        expect(
            shouldSuppressUnhandledRejectionEvent({
                reason: {
                    stack: "at x (moz-extension://wallet/injected.js:1:1)",
                },
            }),
        ).toBe(true);

        expect(
            shouldSuppressWindowErrorEvent({
                filename: "https://scape-client.example/static/js/main.js",
                message: "real app error",
                error: undefined,
            }),
        ).toBe(false);
    });
});
