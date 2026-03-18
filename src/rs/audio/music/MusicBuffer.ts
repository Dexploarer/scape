export class MusicBuffer {
    public buffer: Int8Array;
    public currentPosition: number = 0;
    public bitPosition: number = 0;

    public static BIT_MASKS: number[] = [
        0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535, 131071,
        262143, 524287, 1048575, 2097151, 4194303, 8388607, 16777215, 33554431, 67108863, 134217727,
        268435455, 536870911, 1073741823, 2147483647, -1,
    ];

    constructor(buffer: Int8Array | number[] | null = null) {
        if (buffer) {
            if (buffer instanceof Int8Array) {
                this.buffer = buffer;
            } else {
                this.buffer = new Int8Array(buffer);
            }
        } else {
            this.buffer = new Int8Array(0);
        }
    }

    public putByte(value: number) {
        this.ensureCapacity(1);
        this.buffer[this.currentPosition++] = (value as number) | 0;
    }

    public putShort(value: number) {
        this.ensureCapacity(2);
        this.buffer[this.currentPosition++] = ((value >> 8) as number) | 0;
        this.buffer[this.currentPosition++] = (value as number) | 0;
    }

    public putLEShort(value: number) {
        this.ensureCapacity(2);
        this.buffer[this.currentPosition++] = (value as number) | 0;
        this.buffer[this.currentPosition++] = ((value >> 8) as number) | 0;
    }

    public putInt(value: number) {
        this.ensureCapacity(4);
        this.buffer[this.currentPosition++] = ((value >> 24) as number) | 0;
        this.buffer[this.currentPosition++] = ((value >> 16) as number) | 0;
        this.buffer[this.currentPosition++] = ((value >> 8) as number) | 0;
        this.buffer[this.currentPosition++] = (value as number) | 0;
    }

    public putLEInt(value: number) {
        this.ensureCapacity(4);
        this.buffer[this.currentPosition++] = (value as number) | 0;
        this.buffer[this.currentPosition++] = ((value >> 8) as number) | 0;
        this.buffer[this.currentPosition++] = ((value >> 16) as number) | 0;
        this.buffer[this.currentPosition++] = ((value >> 24) as number) | 0;
    }

    public getUnsignedByte(): number {
        return this.buffer[this.currentPosition++] & 255;
    }

    public getSignedByte(): number {
        return this.buffer[this.currentPosition++];
    }

    public getUnsignedLEShort(): number {
        this.currentPosition += 2;
        return (
            ((this.buffer[this.currentPosition - 2] & 255) << 8) +
            (this.buffer[this.currentPosition - 1] & 255)
        );
    }

    public getSignedShort(): number {
        this.currentPosition += 2;
        let i: number =
            ((this.buffer[this.currentPosition - 2] & 255) << 8) +
            (this.buffer[this.currentPosition - 1] & 255);
        if (i > 32767) {
            i -= 65536;
        }
        return i;
    }

    public getInt(): number {
        this.currentPosition += 4;
        return (
            (((this.buffer[this.currentPosition - 4] & 255) << 24) +
                ((this.buffer[this.currentPosition - 3] & 255) << 16) +
                ((this.buffer[this.currentPosition - 2] & 255) << 8) +
                (this.buffer[this.currentPosition - 1] & 255)) |
            0
        );
    }

    public getSignedSmart(): number {
        const peek: number = this.buffer[this.currentPosition] & 255;
        if (peek < 128) {
            return this.getUnsignedByte() - 64;
        } else {
            return this.getUnsignedLEShort() - 49152;
        }
    }

    public getSmart(): number {
        const peek: number = this.buffer[this.currentPosition] & 255;
        if (peek < 128) {
            return this.getUnsignedByte();
        } else {
            return this.getUnsignedLEShort() - 32768;
        }
    }

    private ensureCapacity(len: number) {
        if (this.currentPosition + len > this.buffer.length) {
            const newBuffer = new Int8Array(
                Math.max(this.buffer.length * 2, this.currentPosition + len),
            );
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
        }
    }
}
