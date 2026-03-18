// Simple PCM buffer helper (mono) for mixing integers to Float32Array
export class PcmBuffer {
    data: Float32Array;
    length: number;

    constructor(size: number) {
        this.data = new Float32Array(size);
        this.length = size;
    }
}
