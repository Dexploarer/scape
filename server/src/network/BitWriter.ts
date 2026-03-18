export class BitWriter {
    private buffer: number[] = [];
    private currentByte = 0;
    private bitOffset = 0;

    writeBits(count: number, value: number): void {
        if (count <= 0 || count > 32) {
            throw new RangeError(`Invalid bit count: ${count}`);
        }
        let remaining = count;
        while (remaining > 0) {
            const free = 8 - this.bitOffset;
            const bits = Math.min(free, remaining);
            const shift = remaining - bits;
            const mask = ((value >>> shift) & ((1 << bits) - 1)) << (free - bits);
            this.currentByte |= mask;
            this.bitOffset += bits;
            remaining -= bits;
            if (this.bitOffset === 8) {
                this.flushCurrentByte();
            }
        }
    }

    writeByte(value: number): void {
        this.alignToByte();
        this.buffer.push(value & 0xff);
    }

    writeShortLE(value: number): void {
        this.writeByte(value & 0xff);
        this.writeByte((value >> 8) & 0xff);
    }

    writeShortBE(value: number): void {
        this.writeByte((value >> 8) & 0xff);
        this.writeByte(value & 0xff);
    }

    writeByteC(value: number): void {
        this.writeByte(-value & 0xff);
    }

    writeIntLE(value: number): void {
        this.writeByte(value & 0xff);
        this.writeByte((value >> 8) & 0xff);
        this.writeByte((value >> 16) & 0xff);
        this.writeByte((value >> 24) & 0xff);
    }

    writeIntBE(value: number): void {
        this.writeByte((value >> 24) & 0xff);
        this.writeByte((value >> 16) & 0xff);
        this.writeByte((value >> 8) & 0xff);
        this.writeByte(value & 0xff);
    }

    /** OSRS "ME" byte order: 8, 0, 24, 16 (see Buffer.writeIntME). */
    writeIntME(value: number): void {
        this.writeByte((value >> 8) & 0xff);
        this.writeByte(value & 0xff);
        this.writeByte((value >> 24) & 0xff);
        this.writeByte((value >> 16) & 0xff);
    }

    writeBytes(bytes: ArrayLike<number>): void {
        this.alignToByte();
        for (let i = 0; i < bytes.length; i++) {
            this.buffer.push(bytes[i] & 0xff);
        }
    }

    alignToByte(): void {
        if (this.bitOffset > 0) {
            this.flushCurrentByte();
        }
    }

    toUint8Array(): Uint8Array {
        this.alignToByte();
        return Uint8Array.from(this.buffer);
    }

    reset(): void {
        this.buffer.length = 0;
        this.currentByte = 0;
        this.bitOffset = 0;
    }

    private flushCurrentByte(): void {
        this.buffer.push(this.currentByte & 0xff);
        this.currentByte = 0;
        this.bitOffset = 0;
    }
}
