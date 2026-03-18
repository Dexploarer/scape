import { Archive } from "../cache/Archive";
import { CacheIndex } from "../cache/CacheIndex";
import { ByteBuffer } from "../io/ByteBuffer";
import { IndexedSprite } from "./IndexedSprite";

export class SpriteLoader {
    static spriteCount: number = 0;
    static xOffsets?: Int32Array;
    static yOffsets?: Int32Array;
    static widths?: Int32Array;
    static heights?: Int32Array;
    static pixels?: Uint8Array[];
    static alphas?: (Uint8Array | undefined)[];
    static width: number = 0;
    static height: number = 0;
    static palette?: Int32Array;

    static load(data: Int8Array): void {
        const buffer = new ByteBuffer(data);

        buffer.offset = data.length - 2;

        SpriteLoader.spriteCount = buffer.readUnsignedShort();
        SpriteLoader.xOffsets = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.yOffsets = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.widths = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.heights = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.pixels = new Array(SpriteLoader.spriteCount);
        SpriteLoader.alphas = new Array(SpriteLoader.spriteCount);

        buffer.offset = data.length - 7 - SpriteLoader.spriteCount * 8;

        SpriteLoader.width = buffer.readUnsignedShort();
        SpriteLoader.height = buffer.readUnsignedShort();
        const paletteSize = (buffer.readUnsignedByte() & 0xff) + 1;

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.xOffsets[i] = buffer.readUnsignedShort();
        }

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.yOffsets[i] = buffer.readUnsignedShort();
        }

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.widths[i] = buffer.readUnsignedShort();
        }

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.heights[i] = buffer.readUnsignedShort();
        }

        buffer.offset = data.length - 7 - SpriteLoader.spriteCount * 8 - (paletteSize - 1) * 3;

        SpriteLoader.palette = new Int32Array(paletteSize);

        for (let i = 1; i < paletteSize; i++) {
            SpriteLoader.palette[i] = buffer.readMedium();
            if (SpriteLoader.palette[i] === 0) {
                SpriteLoader.palette[i] = 1;
            }
        }

        buffer.offset = 0;

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            const width = SpriteLoader.widths[i];
            const height = SpriteLoader.heights[i];
            const pixelCount = width * height;
            const pixels = (SpriteLoader.pixels[i] = new Uint8Array(pixelCount));
            const flags = buffer.readUnsignedByte();
            // Bit 0: 0 = row-wise, 1 = column-wise
            // Bit 1: 0 = no alpha, 1 = has alpha channel
            const isColumnWise = (flags & 1) !== 0;
            const hasAlpha = (flags & 2) !== 0;

            if (!isColumnWise) {
                // Row-wise (format 0 or 2)
                for (let pi = 0; pi < pixelCount; pi++) {
                    pixels[pi] = buffer.readByte();
                }
            } else {
                // Column-wise (format 1 or 3)
                for (let x = 0; x < width; x++) {
                    for (let y = 0; y < height; y++) {
                        pixels[x + y * width] = buffer.readByte();
                    }
                }
            }

            // Read alpha channel if present
            if (hasAlpha) {
                const alphaData = new Uint8Array(pixelCount);
                if (!isColumnWise) {
                    // Row-wise alpha
                    for (let pi = 0; pi < pixelCount; pi++) {
                        alphaData[pi] = buffer.readUnsignedByte();
                    }
                } else {
                    // Column-wise alpha
                    for (let x = 0; x < width; x++) {
                        for (let y = 0; y < height; y++) {
                            alphaData[x + y * width] = buffer.readUnsignedByte();
                        }
                    }
                }
                SpriteLoader.alphas![i] = alphaData;
            }
        }
    }

    static reset() {
        SpriteLoader.xOffsets = undefined;
        SpriteLoader.yOffsets = undefined;
        SpriteLoader.widths = undefined;
        SpriteLoader.heights = undefined;
        SpriteLoader.palette = undefined;
        SpriteLoader.pixels = undefined;
        SpriteLoader.alphas = undefined;
    }

    static loadFromIndex(spriteIndex: CacheIndex, id: number): boolean {
        if (id == null || id < 0) return false;
        let file = undefined as ReturnType<CacheIndex["getFile"]> | undefined;
        // Try IF3-style combined id: high 16 bits = archive id, low 16 bits = file id
        const archiveId = (id >>> 16) & 0xffff;
        const fileId = id & 0xffff;
        try {
            if (archiveId !== 0 || fileId !== 0) {
                file = spriteIndex.getFile(archiveId, fileId);
            }
        } catch {}
        if (!file) {
            try {
                // Fallback to (id, 0) which is common for sprites
                file = spriteIndex.getFile(id, 0);
            } catch {}
        }
        if (file) {
            SpriteLoader.load(file.data);
            return true;
        }
        return false;
    }

    static loadIndexedSpriteDat(archive: Archive, name: string, offset: number): IndexedSprite {
        return this.loadIndexedSpriteDatId(archive, archive.getFileId(name + ".dat"), offset);
    }

    static loadIndexedSpriteDatId(archive: Archive, id: number, offset: number): IndexedSprite {
        const dataFile = archive.getFile(id);
        const indexFile = archive.getFileNamed("index.dat");
        if (!dataFile) {
            throw new Error(id + " sprite not found");
        }
        if (!indexFile) {
            throw new Error("index.dat not found");
        }

        const dataBuffer = new ByteBuffer(dataFile.data);
        const indexBuffer = new ByteBuffer(indexFile.data);

        indexBuffer.offset = dataBuffer.readUnsignedShort();

        const sprite = new IndexedSprite();

        sprite.width = indexBuffer.readUnsignedShort();
        sprite.height = indexBuffer.readUnsignedShort();

        let paletteSize = indexBuffer.readUnsignedByte();

        sprite.palette = new Int32Array(paletteSize);
        for (let i = 0; i < paletteSize - 1; i++) {
            sprite.palette[i + 1] = indexBuffer.readMedium();
        }

        for (let i = 0; i < offset; i++) {
            indexBuffer.offset += 2;
            dataBuffer.offset += indexBuffer.readUnsignedShort() * indexBuffer.readUnsignedShort();
            indexBuffer.offset++;
        }

        sprite.xOffset = indexBuffer.readUnsignedByte();
        sprite.yOffset = indexBuffer.readUnsignedByte();
        sprite.subWidth = indexBuffer.readUnsignedShort();
        sprite.subHeight = indexBuffer.readUnsignedShort();

        const pixelCount = sprite.subWidth * sprite.subHeight;
        sprite.pixels = new Uint8Array(pixelCount);

        const type = indexBuffer.readUnsignedByte();
        if (type === 0) {
            for (let i = 0; i < pixelCount; i++) {
                sprite.pixels[i] = dataBuffer.readByte();
            }
        } else if (type === 1) {
            for (let x = 0; x < sprite.subWidth; x++) {
                for (let y = 0; y < sprite.subHeight; y++) {
                    sprite.pixels[x + y * sprite.subWidth] = dataBuffer.readByte();
                }
            }
        }

        return sprite;
    }

    static loadIntoIndexedSprite(spriteIndex: CacheIndex, id: number): IndexedSprite | undefined {
        if (
            SpriteLoader.loadFromIndex(spriteIndex, id) &&
            SpriteLoader.xOffsets &&
            SpriteLoader.yOffsets &&
            SpriteLoader.widths &&
            SpriteLoader.heights &&
            SpriteLoader.palette &&
            SpriteLoader.pixels
        ) {
            const sprite = new IndexedSprite();

            sprite.width = SpriteLoader.width;
            sprite.height = SpriteLoader.height;
            sprite.xOffset = SpriteLoader.xOffsets[0];
            sprite.yOffset = SpriteLoader.yOffsets[0];
            sprite.subWidth = SpriteLoader.widths[0];
            sprite.subHeight = SpriteLoader.heights[0];
            sprite.palette = SpriteLoader.palette;
            sprite.pixels = SpriteLoader.pixels[0];
            sprite.alpha = SpriteLoader.alphas?.[0];

            SpriteLoader.reset();

            return sprite;
        }
        return undefined;
    }

    static loadIntoIndexedSprites(
        spriteIndex: CacheIndex,
        id: number,
    ): IndexedSprite[] | undefined {
        if (
            SpriteLoader.loadFromIndex(spriteIndex, id) &&
            SpriteLoader.xOffsets &&
            SpriteLoader.yOffsets &&
            SpriteLoader.widths &&
            SpriteLoader.heights &&
            SpriteLoader.palette &&
            SpriteLoader.pixels
        ) {
            const sprites = new Array<IndexedSprite>(SpriteLoader.spriteCount);
            for (let i = 0; i < SpriteLoader.spriteCount; i++) {
                const sprite = (sprites[i] = new IndexedSprite());

                sprite.width = SpriteLoader.width;
                sprite.height = SpriteLoader.height;
                sprite.xOffset = SpriteLoader.xOffsets[i];
                sprite.yOffset = SpriteLoader.yOffsets[i];
                sprite.subWidth = SpriteLoader.widths[i];
                sprite.subHeight = SpriteLoader.heights[i];
                sprite.palette = SpriteLoader.palette;
                sprite.pixels = SpriteLoader.pixels[i];
                sprite.alpha = SpriteLoader.alphas?.[i];
            }

            SpriteLoader.reset();

            return sprites;
        }
        return undefined;
    }
}
