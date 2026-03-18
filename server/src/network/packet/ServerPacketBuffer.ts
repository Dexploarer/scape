/**
 * ServerPacketBuffer - Read binary packets from client
 *
 * Implements all OSRS-specific read methods matching the client's write methods.
 * Each read method is the inverse of its corresponding write method in PacketBuffer.
 */

export class ServerPacketBuffer {
    readonly data: Uint8Array;
    offset: number = 0;

    constructor(data: Uint8Array | ArrayBuffer) {
        if (data instanceof ArrayBuffer) {
            this.data = new Uint8Array(data);
        } else {
            this.data = data;
        }
    }

    /**
     * Get remaining bytes in buffer
     */
    get remaining(): number {
        return this.data.length - this.offset;
    }

    /**
     * Check if there are at least n bytes remaining
     */
    hasRemaining(n: number): boolean {
        return this.remaining >= n;
    }

    // ========================================
    // BYTE READ METHODS
    // ========================================

    /**
     * Read unsigned byte (standard)
     */
    readByte(): number {
        return this.data[this.offset++] & 0xff;
    }

    /**
     * Read signed byte
     */
    readSignedByte(): number {
        const v = this.data[this.offset++];
        return v > 127 ? v - 256 : v;
    }

    /**
     * Read byte with +128 transformation (inverse of writeByteAdd)
     * Server reads: (value - 128) & 0xFF
     */
    readByteAdd(): number {
        return (this.data[this.offset++] - 128) & 0xff;
    }

    /**
     * Read negated byte (inverse of writeByteNeg)
     * Server reads: (0 - value) & 0xFF
     */
    readByteNeg(): number {
        return (0 - this.data[this.offset++]) & 0xff;
    }

    /**
     * Read subtracted byte (inverse of writeByteSub)
     * Server reads: (128 - value) & 0xFF
     */
    readByteSub(): number {
        return (128 - this.data[this.offset++]) & 0xff;
    }

    // ========================================
    // SHORT READ METHODS (2 bytes)
    // ========================================

    /**
     * Read unsigned short big-endian (standard)
     */
    readShort(): number {
        const high = this.data[this.offset++] & 0xff;
        const low = this.data[this.offset++] & 0xff;
        return (high << 8) | low;
    }

    /**
     * Read signed short big-endian
     */
    readSignedShort(): number {
        const v = this.readShort();
        return v > 32767 ? v - 65536 : v;
    }

    /**
     * Read unsigned short little-endian
     */
    readShortLE(): number {
        const low = this.data[this.offset++] & 0xff;
        const high = this.data[this.offset++] & 0xff;
        return (high << 8) | low;
    }

    /**
     * Read short with +128 on low byte (inverse of writeShortAdd)
     * Client writes: [low+128, high] so we read: [low-128, high]
     */
    readShortAdd(): number {
        const low = (this.data[this.offset++] - 128) & 0xff;
        const high = this.data[this.offset++] & 0xff;
        return (high << 8) | low;
    }

    /**
     * Read short with ADD LE encoding (inverse of writeShortAddLE)
     * Client writes: [high, low+128] so we read: [high, low-128]
     */
    readShortAddLE(): number {
        const high = this.data[this.offset++] & 0xff;
        const low = (this.data[this.offset++] - 128) & 0xff;
        return (high << 8) | low;
    }

    // ========================================
    // INT READ METHODS (4 bytes)
    // ========================================

    /**
     * Read unsigned int big-endian (standard)
     */
    readInt(): number {
        const b0 = this.data[this.offset++] & 0xff;
        const b1 = this.data[this.offset++] & 0xff;
        const b2 = this.data[this.offset++] & 0xff;
        const b3 = this.data[this.offset++] & 0xff;
        return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    }

    /**
     * Read signed int big-endian
     */
    readSignedInt(): number {
        const b0 = this.data[this.offset++] & 0xff;
        const b1 = this.data[this.offset++] & 0xff;
        const b2 = this.data[this.offset++] & 0xff;
        const b3 = this.data[this.offset++] & 0xff;
        return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }

    /**
     * Read unsigned int little-endian
     */
    readIntLE(): number {
        const b3 = this.data[this.offset++] & 0xff;
        const b2 = this.data[this.offset++] & 0xff;
        const b1 = this.data[this.offset++] & 0xff;
        const b0 = this.data[this.offset++] & 0xff;
        return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    }

    /**
     * Read int middle-endian (inverse of writeIntME)
     * Order: [b1, b0, b3, b2] -> reconstruct to [b0, b1, b2, b3]
     */
    readIntME(): number {
        const b1 = this.data[this.offset++] & 0xff;
        const b0 = this.data[this.offset++] & 0xff;
        const b3 = this.data[this.offset++] & 0xff;
        const b2 = this.data[this.offset++] & 0xff;
        return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    }

    /**
     * Read int inverse middle-endian (inverse of writeIntIME)
     * Order: [b2, b3, b0, b1] -> reconstruct to [b0, b1, b2, b3]
     */
    readIntIME(): number {
        const b2 = this.data[this.offset++] & 0xff;
        const b3 = this.data[this.offset++] & 0xff;
        const b0 = this.data[this.offset++] & 0xff;
        const b1 = this.data[this.offset++] & 0xff;
        return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    }

    // ========================================
    // STRING READ METHODS
    // ========================================

    /**
     * Read null-terminated string
     */
    readString(): string {
        let result = "";
        let byte: number;
        while ((byte = this.data[this.offset++]) !== 0) {
            result += String.fromCharCode(byte);
        }
        return result;
    }

    /**
     * Read newline-terminated string (used in some OSRS packets)
     */
    readStringLine(): string {
        let result = "";
        let byte: number;
        while ((byte = this.data[this.offset++]) !== 10) {
            // 10 = newline
            result += String.fromCharCode(byte);
        }
        return result;
    }

    // ========================================
    // RAW BYTE METHODS
    // ========================================

    /**
     * Read raw bytes into new array
     */
    readBytes(length: number): Uint8Array {
        const result = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
    }

    /**
     * Read raw bytes into existing array
     */
    readBytesInto(dest: Uint8Array, destOffset: number, length: number): void {
        for (let i = 0; i < length; i++) {
            dest[destOffset + i] = this.data[this.offset++];
        }
    }

    // ========================================
    // SMART METHODS (variable-length encoding)
    // ========================================

    /**
     * Read smart value (1 or 2 bytes)
     * If high bit set, read as short, otherwise byte
     */
    readSmart(): number {
        const peek = this.data[this.offset] & 0xff;
        if (peek < 128) {
            return this.readByte();
        } else {
            return this.readShort() - 32768;
        }
    }

    /**
     * Read unsigned smart (1 or 2 bytes, unsigned)
     */
    readUnsignedSmart(): number {
        const peek = this.data[this.offset] & 0xff;
        if (peek < 128) {
            return this.readByte();
        } else {
            return this.readShort() - 32768;
        }
    }

    /**
     * Read big smart (2 or 4 bytes)
     */
    readBigSmart(): number {
        const peek = this.data[this.offset] & 0xff;
        if (peek < 128) {
            return this.readShort();
        } else {
            return this.readInt() - 0x80000000;
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Skip n bytes
     */
    skip(n: number): void {
        this.offset += n;
    }

    /**
     * Reset offset to beginning
     */
    reset(): void {
        this.offset = 0;
    }

    /**
     * Get a view of remaining data
     */
    getRemainingData(): Uint8Array {
        return this.data.slice(this.offset);
    }

    /**
     * Create from ArrayBuffer (convenience)
     */
    static fromArrayBuffer(buffer: ArrayBuffer): ServerPacketBuffer {
        return new ServerPacketBuffer(buffer);
    }
}
