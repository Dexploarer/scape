/**
 * Bit-level reader for Vorbis data (port of class60).
 * Reads bits in LSB-first order as per Vorbis specification.
 */
export class VorbisBitReader {
    private data: Uint8Array;
    private byteOffset: number = 0;
    private bitOffset: number = 0;

    constructor(data?: Uint8Array) {
        this.data = data ?? new Uint8Array(0);
    }

    /**
     * Initialize with new data buffer
     */
    init(data: Uint8Array, offset: number = 0): void {
        this.data = data;
        this.byteOffset = offset;
        this.bitOffset = 0;
    }

    /**
     * Read n bits (up to 32) as unsigned integer, LSB-first
     */
    readBits(n: number): number {
        let result = 0;
        let shift = 0;

        while (n >= 8 - this.bitOffset) {
            const bitsToRead = 8 - this.bitOffset;
            const mask = (1 << bitsToRead) - 1;
            result += ((this.data[this.byteOffset] >> this.bitOffset) & mask) << shift;
            this.bitOffset = 0;
            this.byteOffset++;
            shift += bitsToRead;
            n -= bitsToRead;
        }

        if (n > 0) {
            const mask = (1 << n) - 1;
            result += ((this.data[this.byteOffset] >> this.bitOffset) & mask) << shift;
            this.bitOffset += n;
        }

        return result;
    }

    /**
     * Read a single bit
     */
    readBit(): number {
        const bit = (this.data[this.byteOffset] >> this.bitOffset) & 1;
        this.bitOffset++;
        this.byteOffset += this.bitOffset >> 3;
        this.bitOffset &= 7;
        return bit;
    }

    /**
     * Read a boolean (single bit)
     */
    readFlag(): boolean {
        return this.readBit() !== 0;
    }

    /**
     * Get current byte position
     */
    get position(): number {
        return this.byteOffset;
    }

    /**
     * Get remaining bytes
     */
    get remaining(): number {
        return this.data.length - this.byteOffset;
    }
}

// Shared instance for setup parsing (matches OSRS pattern)
export const sharedBitReader = new VorbisBitReader();
