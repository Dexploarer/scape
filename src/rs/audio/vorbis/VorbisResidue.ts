/**
 * Vorbis Residue (port of VorbisResidue.java).
 * Handles residue vector decoding for spectral coefficients.
 */
import { VorbisBitReader, sharedBitReader } from "./VorbisBitReader";
import { VorbisCodebook } from "./VorbisCodebook";

export class VorbisResidue {
    residueType: number;
    begin: number;
    end: number;
    partitionSize: number;
    classifications: number;
    classbook: number;
    cascade: Int32Array;

    private codebooks: VorbisCodebook[];

    constructor(reader: VorbisBitReader = sharedBitReader, codebooks: VorbisCodebook[] = []) {
        this.codebooks = codebooks;

        this.residueType = reader.readBits(16);
        this.begin = reader.readBits(24);
        this.end = reader.readBits(24);
        this.partitionSize = reader.readBits(24) + 1;
        this.classifications = reader.readBits(6) + 1;
        this.classbook = reader.readBits(8);

        // Read classification cascade
        const cascadeRaw = new Int32Array(this.classifications);
        for (let i = 0; i < this.classifications; i++) {
            let cascadeVal = 0;
            const low = reader.readBits(3);
            const hasHigh = reader.readFlag();
            if (hasHigh) {
                const high = reader.readBits(5);
                cascadeVal = (high << 3) | low;
            } else {
                cascadeVal = low;
            }
            cascadeRaw[i] = cascadeVal;
        }

        // Build cascade book array (8 passes per classification)
        this.cascade = new Int32Array(this.classifications * 8);
        for (let i = 0; i < this.classifications * 8; i++) {
            const classNum = i >> 3;
            const pass = i & 7;
            if ((cascadeRaw[classNum] & (1 << pass)) !== 0) {
                this.cascade[i] = reader.readBits(8);
            } else {
                this.cascade[i] = -1;
            }
        }
    }

    /**
     * Set codebooks reference (called after all codebooks are loaded)
     */
    setCodebooks(codebooks: VorbisCodebook[]): void {
        this.codebooks = codebooks;
    }

    /**
     * Decode residue into output buffer
     * @param output Output buffer to fill
     * @param n Number of samples (half block size)
     * @param doNotDecode If true, skip decoding but still read bits
     * @param reader Bit reader
     */
    decode(output: Float32Array, n: number, doNotDecode: boolean, reader: VorbisBitReader): void {
        // Clear output
        for (let i = 0; i < n; i++) {
            output[i] = 0;
        }

        if (doNotDecode) {
            return;
        }

        const cbDimensions = this.codebooks[this.classbook].dimensions;
        const residueSize = this.end - this.begin;
        const partitionCount = Math.floor(residueSize / this.partitionSize);
        const classWords = new Int32Array(partitionCount);

        // Iterate through 8 passes
        for (let pass = 0; pass < 8; pass++) {
            let partitionIdx = 0;

            while (partitionIdx < partitionCount) {
                // Decode classification
                if (pass === 0) {
                    let cval = this.codebooks[this.classbook].decodeScalar(reader);
                    for (let j = cbDimensions - 1; j >= 0; j--) {
                        if (partitionIdx + j < partitionCount) {
                            classWords[partitionIdx + j] = cval % this.classifications;
                        }
                        cval = Math.floor(cval / this.classifications);
                    }
                }

                // Decode residue values
                for (let j = 0; j < cbDimensions; j++) {
                    const classNum = classWords[partitionIdx];
                    const book = this.cascade[pass + classNum * 8];

                    if (book >= 0) {
                        const offset = partitionIdx * this.partitionSize + this.begin;
                        const cb = this.codebooks[book];

                        if (this.residueType === 0) {
                            // Type 0: interleaved
                            const step = Math.floor(this.partitionSize / cb.dimensions);
                            for (let k = 0; k < step; k++) {
                                const vec = cb.decodeVector(reader);
                                if (vec) {
                                    for (let d = 0; d < cb.dimensions; d++) {
                                        const idx = offset + k + d * step;
                                        if (idx >= 0 && idx < n) {
                                            output[idx] += vec[d];
                                        }
                                    }
                                }
                            }
                        } else {
                            // Type 1 and 2: sequential
                            let pos = 0;
                            while (pos < this.partitionSize) {
                                const vec = cb.decodeVector(reader);
                                if (vec) {
                                    for (let d = 0; d < cb.dimensions; d++) {
                                        const idx = offset + pos;
                                        if (idx >= 0 && idx < n) {
                                            output[idx] += vec[d];
                                        }
                                        pos++;
                                    }
                                } else {
                                    break;
                                }
                            }
                        }
                    }

                    partitionIdx++;
                    if (partitionIdx >= partitionCount) {
                        break;
                    }
                }
            }
        }
    }
}
