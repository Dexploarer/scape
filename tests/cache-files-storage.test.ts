import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { CacheFiles } from "../src/rs/cache/CacheFiles";
import { SectorCluster } from "../src/rs/cache/store/SectorCluster";

type CacheLike = {
    match(request: RequestInfo, options?: CacheQueryOptions): Promise<Response | undefined>;
    matchAll?(request: RequestInfo, options?: CacheQueryOptions): Promise<Response[]>;
    put(request: RequestInfo, response: Response): Promise<void>;
    delete(request: RequestInfo, options?: CacheQueryOptions): Promise<boolean>;
};

const originalFetch = globalThis.fetch;
const originalCaches = (globalThis as { caches?: CacheStorage }).caches;
const originalConsoleWarn = console.warn;

function createResponse(body: Uint8Array, contentType: string): Response {
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": body.byteLength.toString(),
        },
    });
}

describe("CacheFiles storage fallback", () => {
    const warnings: unknown[][] = [];

    beforeEach(() => {
        warnings.length = 0;
        console.warn = (...args: unknown[]) => {
            warnings.push(args);
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        if (originalCaches === undefined) {
            delete (globalThis as { caches?: CacheStorage }).caches;
        } else {
            (globalThis as { caches?: CacheStorage }).caches = originalCaches;
        }
        console.warn = originalConsoleWarn;
    });

    test("keeps loading dat2 caches when final cache persistence fails", async () => {
        const cacheWrites: string[] = [];
        const fakeCache: CacheLike = {
            async match() {
                return undefined;
            },
            async matchAll() {
                return [];
            },
            async put(request) {
                const url = typeof request === "string" ? request : request.url;
                cacheWrites.push(url);
                if (url.endsWith("/main_file_cache.dat2")) {
                    throw new TypeError(
                        "Failed to execute 'put' on 'Cache': Cache.put() encountered a network error",
                    );
                }
            },
            async delete() {
                return true;
            },
        };

        (globalThis as { caches?: { open(name: string): Promise<CacheLike> } }).caches = {
            async open() {
                return fakeCache;
            },
        };

        const metaBytes = new Uint8Array(SectorCluster.SIZE);
        metaBytes[2] = 1;
        const dat2Bytes = new Uint8Array([1, 2, 3, 4]);
        const indexBytes = new Uint8Array([9, 8, 7, 6]);

        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.endsWith("/main_file_cache.dat2")) {
                return createResponse(dat2Bytes, "application/octet-stream");
            }
            if (url.endsWith("/main_file_cache.idx255")) {
                return createResponse(metaBytes, "application/octet-stream");
            }
            if (url.endsWith("/main_file_cache.idx0")) {
                return createResponse(indexBytes, "application/octet-stream");
            }
            throw new Error(`Unexpected fetch: ${url}`);
        }) as typeof fetch;

        const files = await CacheFiles.fetchDat2("https://cache.example/caches/test/", "test", [0]);

        expect(new Uint8Array(files.files.get("main_file_cache.dat2")!)).toEqual(dat2Bytes);
        expect(new Uint8Array(files.files.get("main_file_cache.idx255")!)).toEqual(metaBytes);
        expect(new Uint8Array(files.files.get("main_file_cache.idx0")!)).toEqual(indexBytes);
        expect(cacheWrites.some((url) => url.endsWith("/main_file_cache.dat2"))).toBe(true);
        expect(
            warnings.some(
                ([message]) =>
                    typeof message === "string" &&
                    message.includes("[storage] cache write skipped for main_file_cache.dat2"),
            ),
        ).toBe(true);
    });
});
