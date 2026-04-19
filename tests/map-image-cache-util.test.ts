import { describe, expect, test } from "bun:test";

import {
    createCacheableImageResponse,
    createMapImageCacheRequest,
} from "../src/client/MapImageCacheUtil";

describe("MapImageCacheUtil", () => {
    test("creates a cache request with the cache-name header", () => {
        const request = createMapImageCacheRequest("/map-images/live/50_50.png", "live");

        expect(request.method).toBe("GET");
        expect(request.url).toContain("/map-images/live/50_50.png");
        expect(request.headers.get("RS-Cache-Name")).toBe("live");
    });

    test("rebuilds image responses into cacheable blob-backed responses", async () => {
        const response = new Response(new Blob(["pngdata"], { type: "image/png" }), {
            status: 200,
            headers: {
                "Content-Type": "image/png",
            },
        });

        const cacheable = await createCacheableImageResponse(response);

        expect(cacheable).toBeDefined();
        expect(cacheable?.headers.get("Content-Type")).toBe("image/png");
        expect(cacheable?.headers.get("Content-Length")).toBe("7");
        expect(await cacheable?.text()).toBe("pngdata");
    });

    test("rejects non-image responses", async () => {
        const response = new Response("nope", {
            status: 200,
            headers: {
                "Content-Type": "text/plain",
            },
        });

        expect(await createCacheableImageResponse(response)).toBeUndefined();
    });
});
