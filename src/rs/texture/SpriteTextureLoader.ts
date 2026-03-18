import { clamp } from "../../util/MathUtil";
import { CacheIndex } from "../cache/CacheIndex";
import { ByteBuffer } from "../io/ByteBuffer";
import { IndexedSprite } from "../sprite/IndexedSprite";
import { SpriteLoader } from "../sprite/SpriteLoader";
import { brightenRgb } from "../util/ColorUtil";
import { TextureLoader } from "./TextureLoader";
import { TextureMaterial } from "./TextureMaterial";

export class SpriteTextureLoader implements TextureLoader {
    static ANIM_DIRECTION_UV = [
        [0.0, 0.0],
        [0.0, -1.0],
        [-1.0, 0.0],
        [0.0, 1.0],
        [1.0, 0.0],
    ];

    idIndexMap: Map<number, number>;

    static load(
        textureIndex: CacheIndex,
        spriteIndex: CacheIndex,
        isSimplified: boolean,
    ): SpriteTextureLoader {
        const definitions = new Map<number, TextureDefinition>();

        const textureArchive = textureIndex.getArchive(0);
        const textureIds = Array.from(textureArchive.fileIds);
        for (let i = 0; i < textureIds.length; i++) {
            const textureId = textureIds[i];
            const file = textureArchive.getFile(textureId);
            if (file) {
                const buffer = file.getDataAsBuffer();
                const definition = isSimplified
                    ? TextureDefinition.decodeSimplified(textureId, buffer)
                    : TextureDefinition.decode(textureId, buffer);
                definitions.set(textureId, definition);
            }
        }

        return new SpriteTextureLoader(spriteIndex, textureIds, definitions);
    }

    constructor(
        readonly spriteIndex: CacheIndex,
        readonly textureIds: number[],
        readonly definitions: Map<number, TextureDefinition>,
    ) {
        this.idIndexMap = new Map();
        for (let i = 0; i < textureIds.length; i++) {
            this.idIndexMap.set(textureIds[i], i);
        }
    }

    getTextureIds(): number[] {
        return this.textureIds;
    }

    getTextureIndex(id: number): number {
        return this.idIndexMap.get(id) ?? -1;
    }

    isSd(id: number): boolean {
        return true;
    }

    isSmall(id: number): boolean {
        return this.loadTextureSprite(id).subWidth === 64;
    }

    getAverageHsl(id: number): number {
        return this.definitions.get(id)?.averageHsl ?? 0;
    }

    getAnimationUv(id: number): [number, number] {
        const def = this.definitions.get(id);
        if (!def) {
            return [0, 0];
        }

        const direction = def.animationDirection;
        const speed = def.animationSpeed;

        const uv = SpriteTextureLoader.ANIM_DIRECTION_UV[direction];

        return [uv[0] * speed, uv[1] * speed];
    }

    isTransparent(id: number): boolean {
        const def = this.definitions.get(id);
        if (!def) {
            return false;
        }
        return !def.opaque;
    }

    getMaterial(id: number): TextureMaterial {
        const def = this.definitions.get(id);
        if (!def) {
            return {
                animU: 0,
                animV: 0,
                alphaCutOff: 0.1,
                frameCount: 1,
                animSpeed: 0,
            };
        }

        const direction = def.animationDirection;
        const speed = def.animationSpeed;

        const uv = SpriteTextureLoader.ANIM_DIRECTION_UV[direction];

        const animU = uv[0] * speed;
        const animV = uv[1] * speed;

        let alphaCutOff = 0.5;
        if (animU !== 0 || animV !== 0) {
            alphaCutOff = 0.1;
        }

        const frameCount = speed > 0 && def.spriteCount > 1 ? def.spriteCount : 1;

        return {
            animU,
            animV,
            alphaCutOff,
            frameCount,
            animSpeed: speed,
        };
    }

    getFrameCount(id: number): number {
        const def = this.definitions.get(id);
        if (!def) return 1;
        return def.animationSpeed > 0 && def.spriteCount > 1 ? def.spriteCount : 1;
    }

    loadTextureSprite(id: number): IndexedSprite {
        const def = this.definitions.get(id);
        if (!def) {
            throw new Error("Texture definition not found: " + id);
        }

        for (let i = 0; i < def.spriteIds.length; i++) {
            const sprite = SpriteLoader.loadIntoIndexedSprite(this.spriteIndex, def.spriteIds[i]);
            if (!sprite) {
                throw new Error("Texture references invalid sprite");
            }
            sprite.normalize();
            return sprite;
        }
        throw new Error("Texture has no sprites");
    }

    getPixelsRgb(
        id: number,
        size: number,
        flipH: boolean,
        brightness: number,
        frame: number = 0,
    ): Int32Array {
        const def = this.definitions.get(id);
        if (!def) {
            throw new Error("Texture definition not found: " + id);
        }

        const pixelCount = size * size;
        const pixels = new Int32Array(pixelCount);

        const spriteIndex = clamp(frame, 0, def.spriteIds.length - 1);
        const sprite = SpriteLoader.loadIntoIndexedSprite(
            this.spriteIndex,
            def.spriteIds[spriteIndex],
        );
        if (!sprite) {
            throw new Error("Texture references invalid sprite");
        }
        sprite.normalize();

        const palettePixels = sprite.pixels;
        const palette = sprite.palette;
        const transform = def.transforms[spriteIndex];

        // not used by any texture but who knows
        if ((transform & -0x1000000) === 0x3000000) {
            // red, 0, blue
            const r_b = transform & 0xff00ff;
            // green
            const green = (transform >> 8) & 0xff;

            for (let pi = 0; pi < palette.length; pi++) {
                const color = palette[pi];
                const rg = color >> 8;
                const gb = color & 0xffff;
                if (rg === gb) {
                    const blue = color & 0xff;
                    palette[pi] = (((r_b * blue) >> 8) & 0xff00ff) | ((green * blue) & 0xff00);
                }
            }
        }

        for (let pi = 0; pi < palette.length; pi++) {
            let alpha = 0xff;
            if (palette[pi] === 0) {
                alpha = 0;
            }
            palette[pi] = (alpha << 24) | brightenRgb(palette[pi], brightness);
        }

        if (size === sprite.subWidth) {
            for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                const paletteIndex = palettePixels[pixelIndex];
                pixels[pixelIndex] = palette[paletteIndex];
            }
        } else if (sprite.subWidth === 64 && size === 128) {
            let pixelIndex = 0;

            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const paletteIndex = palettePixels[((x >> 1) << 6) + (y >> 1)];
                    pixels[pixelIndex++] = palette[paletteIndex];
                }
            }
        } else {
            if (sprite.subWidth !== 128 || size !== 64) {
                throw new Error("Texture sprite has unexpected size");
            }

            let pixelIndex = 0;

            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const paletteIndex = palettePixels[(y << 1) + ((x << 1) << 7)];
                    pixels[pixelIndex++] = palette[paletteIndex];
                }
            }
        }

        return pixels;
    }

    getPixelsArgb(
        id: number,
        size: number,
        flipH: boolean,
        brightness: number,
        frame?: number,
    ): Int32Array {
        return this.getPixelsRgb(id, size, flipH, brightness, frame);
    }
}

class TextureDefinition {
    static decodeSimplified(id: number, buffer: ByteBuffer): TextureDefinition {
        const spriteId = buffer.readUnsignedShort();
        const averageHsl = buffer.readUnsignedShort();
        const opaque = buffer.readUnsignedByte() === 1;
        const animationDirection = buffer.readUnsignedByte();
        const animationSpeed = buffer.readUnsignedByte();

        return new TextureDefinition(
            id,
            averageHsl,
            opaque,
            1,
            [spriteId],
            [0],
            animationDirection,
            animationSpeed,
        );
    }

    static decode(id: number, buffer: ByteBuffer): TextureDefinition {
        const averageHsl = buffer.readUnsignedShort();
        const opaque = buffer.readUnsignedByte() === 1;
        const spriteCount = buffer.readUnsignedByte();
        if (spriteCount < 1 || spriteCount > 4) {
            throw new Error("Invalid sprite count for texture: " + spriteCount);
        }

        const spriteIds = new Array<number>(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            spriteIds[i] = buffer.readUnsignedShort();
        }

        let spriteTypes: number[] | undefined;
        if (spriteCount > 1) {
            spriteTypes = new Array(spriteCount - 1);
            for (let i = 0; i < spriteCount - 1; i++) {
                spriteTypes[i] = buffer.readUnsignedByte();
            }
        }
        let unused: number[] | undefined;
        if (spriteCount > 1) {
            unused = new Array(spriteCount - 1);
            for (let i = 0; i < spriteCount - 1; i++) {
                unused[i] = buffer.readUnsignedByte();
            }
        }

        const transforms = new Array<number>(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            transforms[i] = buffer.readInt();
        }

        const animationDirection = buffer.readUnsignedByte();
        const animationSpeed = buffer.readUnsignedByte();

        return new TextureDefinition(
            id,
            averageHsl,
            opaque,
            spriteCount,
            spriteIds,
            transforms,
            animationDirection,
            animationSpeed,
            spriteTypes,
            unused,
        );
    }

    constructor(
        readonly id: number,
        readonly averageHsl: number,
        readonly opaque: boolean,
        readonly spriteCount: number,
        readonly spriteIds: number[],
        readonly transforms: number[],
        readonly animationDirection: number,
        readonly animationSpeed: number,
        readonly spriteTypes?: number[],
        readonly unused?: number[],
    ) {}
}
