/** @jest-environment node */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

import { CacheFiles } from "../CacheFiles";
import { CacheSystem } from "../CacheSystem";
import { IndexType } from "../IndexType";

function readFileAsArrayBuffer(filePath: string): ArrayBuffer {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe("MemoryStore legacy loading", () => {
    const cacheDir = path.resolve(__dirname, "../../../../caches/osrs-232_2025-08-27");

    if (!fs.existsSync(cacheDir)) {
        it("requires the OSRS cache fixture", () => {
            throw new Error(
                `Cache directory missing at ${cacheDir}. Run 'node scripts/download-caches.js' before executing tests.`,
            );
        });
        return;
    }

    const expectedHashes: Record<string, string> = {
        "models:0": "3573237f6a0e0aec9bce10a3149783446632d13cbd5749704493566153ddf425",
        "models:100": "acfd28ec64c0f941088fbc162518552a6f5d2ed06d191052b30bed71e28a5213",
        "models:5000": "c7cc3172f0357972821d5bf3a610725959ea199071f5f01aaeb9eb7a604f9e5c",
        "animations:0": "0cc6a6988941d1525824b5b3dfa1f87c01e90cec99be86abbd524485990fe3d2",
        "maps:12851": "96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7",
    };

    let cacheSystem: CacheSystem;

    beforeAll(() => {
        const files = new Map<string, ArrayBuffer>();
        const add = (name: string) => {
            const filePath = path.join(cacheDir, name);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Missing cache component: ${name}`);
            }
            files.set(name, readFileAsArrayBuffer(filePath));
        };

        add(CacheFiles.DAT2_FILE_NAME);
        add(CacheFiles.META_FILE_NAME);
        [IndexType.DAT2.models, IndexType.DAT2.animations, IndexType.DAT2.maps].forEach((indexId) =>
            add(CacheFiles.INDEX_FILE_PREFIX + indexId),
        );

        const cacheFiles = new CacheFiles(files);
        cacheSystem = CacheSystem.fromFiles("dat2", cacheFiles, [
            IndexType.DAT2.models,
            IndexType.DAT2.animations,
            IndexType.DAT2.maps,
        ]);
    });

    function hashArchive(indexId: number, archiveId: number): string {
        const index = cacheSystem.getIndex(indexId);
        const archive = index.getArchive(archiveId);
        const file = archive.getFile(archive.lastFileId);
        if (!file) {
            throw new Error(`Archive ${archiveId} in index ${indexId} has no file`);
        }

        const data = file.data;
        const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        return createHash("sha256").update(buffer).digest("hex");
    }

    it("produces stable archive payloads identical to the legacy load", () => {
        expect(hashArchive(IndexType.DAT2.models, 0)).toBe(expectedHashes["models:0"]);
        expect(hashArchive(IndexType.DAT2.models, 100)).toBe(expectedHashes["models:100"]);
        expect(hashArchive(IndexType.DAT2.models, 5000)).toBe(expectedHashes["models:5000"]);
        expect(hashArchive(IndexType.DAT2.animations, 0)).toBe(expectedHashes["animations:0"]);
        expect(hashArchive(IndexType.DAT2.maps, 12851)).toBe(expectedHashes["maps:12851"]);
    });
});
