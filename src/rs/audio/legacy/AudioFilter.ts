import { ByteBuffer } from "../../io/ByteBuffer";
import { SoundEnvelope } from "./SoundEnvelope";

/**
 * Legacy biquad audio filter used by synthesized sound effects.
 */
export class AudioFilter {
    private static readonly temp = [new Float32Array(8), new Float32Array(8)];
    private static readonly coeffs = [new Int32Array(8), new Int32Array(8)];

    private static forwardMultiplier = 0;
    private static forwardScale = 0;

    readonly pairs = new Int32Array(2);
    private readonly field415 = [
        [new Int32Array(4), new Int32Array(4)],
        [new Int32Array(4), new Int32Array(4)],
    ];
    private readonly field418 = [
        [new Int32Array(4), new Int32Array(4)],
        [new Int32Array(4), new Int32Array(4)],
    ];
    private readonly field416 = new Int32Array(2);

    compute(direction: number, blend: number): number {
        let resultLength = 0;
        if (direction === 0) {
            const value =
                (this.field416[0] + (this.field416[1] - this.field416[0]) * blend) * 0.0030517578;
            AudioFilter.forwardScale = Math.pow(0.1, value / 20.0);
            AudioFilter.forwardMultiplier = (AudioFilter.forwardScale * 65536.0) | 0;
        }

        if (this.pairs[direction] === 0) {
            return 0;
        }

        let var3 = this.method1164(direction, 0, blend) * 1.0;
        AudioFilter.temp[direction][0] =
            -2.0 * var3 * Math.cos(this.method1150(direction, 0, blend));
        AudioFilter.temp[direction][1] = var3 * var3;

        for (let pair = 1; pair < this.pairs[direction]; pair++) {
            var3 = this.method1164(direction, pair, blend);
            const var5 = -2.0 * var3 * Math.cos(this.method1150(direction, pair, blend));
            const var6 = var3 * var3;
            const idx = pair * 2;
            AudioFilter.temp[direction][idx + 1] = AudioFilter.temp[direction][idx - 1] * var6;
            AudioFilter.temp[direction][idx] =
                AudioFilter.temp[direction][idx - 1] * var5 +
                AudioFilter.temp[direction][idx - 2] * var6;

            for (let i = idx - 1; i >= 2; i--) {
                AudioFilter.temp[direction][i] +=
                    AudioFilter.temp[direction][i - 1] * var5 +
                    AudioFilter.temp[direction][i - 2] * var6;
            }

            AudioFilter.temp[direction][1] += AudioFilter.temp[direction][0] * var5 + var6;
            AudioFilter.temp[direction][0] += var5;
        }

        if (direction === 0) {
            for (let i = 0; i < this.pairs[0] * 2; i++) {
                AudioFilter.temp[0][i] *= AudioFilter.forwardScale;
            }
        }

        for (let i = 0; i < this.pairs[direction] * 2; i++) {
            AudioFilter.coeffs[direction][i] = (AudioFilter.temp[direction][i] * 65536.0) | 0;
        }

        resultLength = this.pairs[direction] * 2;
        return resultLength;
    }

    method1151(buffer: ByteBuffer, envelope: SoundEnvelope): void {
        const combined = buffer.readUnsignedByte();
        this.pairs[0] = combined >> 4;
        this.pairs[1] = combined & 0xf;
        if (combined === 0) {
            this.field416[0] = 0;
            this.field416[1] = 0;
            return;
        }

        this.field416[0] = buffer.readUnsignedShort();
        this.field416[1] = buffer.readUnsignedShort();
        const flags = buffer.readUnsignedByte();

        for (let dir = 0; dir < 2; dir++) {
            for (let pair = 0; pair < this.pairs[dir]; pair++) {
                this.field415[dir][0][pair] = buffer.readUnsignedShort();
                this.field418[dir][0][pair] = buffer.readUnsignedShort();
            }
        }

        for (let dir = 0; dir < 2; dir++) {
            for (let pair = 0; pair < this.pairs[dir]; pair++) {
                if ((flags & (1 << (dir * 4 + pair))) !== 0) {
                    this.field415[dir][1][pair] = buffer.readUnsignedShort();
                    this.field418[dir][1][pair] = buffer.readUnsignedShort();
                } else {
                    this.field415[dir][1][pair] = this.field415[dir][0][pair];
                    this.field418[dir][1][pair] = this.field418[dir][0][pair];
                }
            }
        }

        if (flags !== 0 || this.field416[0] !== this.field416[1]) {
            envelope.decodeSegments(buffer);
        }
    }

    static normalize(value: number): number {
        const hz = 32.703197 * Math.pow(2, value);
        return (hz * Math.PI) / 11025.0;
    }

    private method1164(dir: number, pair: number, blend: number): number {
        const p0 = this.field418[dir][0][pair];
        const p1 = this.field418[dir][1][pair];
        const value = (p0 + (p1 - p0) * blend) * 0.0015258789;
        return 1.0 - Math.pow(10.0, -value / 20.0);
    }

    private method1150(dir: number, pair: number, blend: number): number {
        const p0 = this.field415[dir][0][pair];
        const p1 = this.field415[dir][1][pair];
        const value = (p0 + (p1 - p0) * blend) * 1.2207031e-4;
        return AudioFilter.normalize(value);
    }

    static getCoefficients(direction: number): Int32Array {
        return AudioFilter.coeffs[direction];
    }

    static getForwardMultiplier(): number {
        return AudioFilter.forwardMultiplier;
    }
}
