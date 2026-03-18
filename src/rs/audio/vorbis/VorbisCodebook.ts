/**
 * Vorbis Codebook (port of VorbisCodebook.java).
 * Huffman codebook used for symbol decoding in Vorbis.
 */
import { VorbisBitReader, sharedBitReader } from "./VorbisBitReader";
import { bitReverse, float32Unpack, iLog } from "./VorbisUtils";

export class VorbisCodebook {
    dimensions: number = 0;
    entries: number = 0;
    lengthMap: Int32Array = new Int32Array(0);
    quantValues: Int32Array | null = null;
    valueVectors: Float32Array[] | null = null;
    huffmanTree: Int32Array = new Int32Array(0);

    constructor(reader: VorbisBitReader = sharedBitReader) {
        // Skip sync pattern (24 bits)
        reader.readBits(24);

        this.dimensions = reader.readBits(16);
        this.entries = reader.readBits(24);
        this.lengthMap = new Int32Array(this.entries);

        const ordered = reader.readFlag();

        if (ordered) {
            let currentEntry = 0;
            for (
                let currentLength = reader.readBits(5) + 1;
                currentEntry < this.entries;
                currentLength++
            ) {
                const count = reader.readBits(iLog(this.entries - currentEntry));
                for (let i = 0; i < count; i++) {
                    this.lengthMap[currentEntry++] = currentLength;
                }
            }
        } else {
            const sparse = reader.readFlag();
            for (let i = 0; i < this.entries; i++) {
                if (sparse && !reader.readFlag()) {
                    this.lengthMap[i] = 0;
                } else {
                    this.lengthMap[i] = reader.readBits(5) + 1;
                }
            }
        }

        this.buildHuffmanTree();

        const lookupType = reader.readBits(4);
        if (lookupType > 0) {
            const minValue = float32Unpack(reader.readBits(32));
            const deltaValue = float32Unpack(reader.readBits(32));
            const valueBits = reader.readBits(4) + 1;
            const sequenceP = reader.readFlag();

            let quantCount: number;
            if (lookupType === 1) {
                quantCount = this.mapType1QuantValues(this.entries, this.dimensions);
            } else {
                quantCount = this.entries * this.dimensions;
            }

            this.quantValues = new Int32Array(quantCount);
            for (let i = 0; i < quantCount; i++) {
                this.quantValues[i] = reader.readBits(valueBits);
            }

            this.valueVectors = new Array(this.entries);
            for (let i = 0; i < this.entries; i++) {
                this.valueVectors[i] = new Float32Array(this.dimensions);
            }

            if (lookupType === 1) {
                for (let entry = 0; entry < this.entries; entry++) {
                    let last = 0;
                    let indexDivisor = 1;
                    for (let dim = 0; dim < this.dimensions; dim++) {
                        const quantIndex = Math.floor(entry / indexDivisor) % quantCount;
                        const value = this.quantValues[quantIndex] * deltaValue + minValue + last;
                        this.valueVectors[entry][dim] = value;
                        if (sequenceP) {
                            last = value;
                        }
                        indexDivisor *= quantCount;
                    }
                }
            } else {
                for (let entry = 0; entry < this.entries; entry++) {
                    let last = 0;
                    let quantOffset = entry * this.dimensions;
                    for (let dim = 0; dim < this.dimensions; dim++) {
                        const value = this.quantValues[quantOffset] * deltaValue + minValue + last;
                        this.valueVectors[entry][dim] = value;
                        if (sequenceP) {
                            last = value;
                        }
                        quantOffset++;
                    }
                }
            }
        }
    }

    private buildHuffmanTree(): void {
        const codewords = new Int32Array(this.entries);
        const available = new Int32Array(33);

        for (let entry = 0; entry < this.entries; entry++) {
            const length = this.lengthMap[entry];
            if (length === 0) continue;

            const bit = 1 << (32 - length);
            const codeword = available[length];
            codewords[entry] = codeword;

            let newAvailable: number;
            if ((codeword & bit) !== 0) {
                newAvailable = available[length - 1];
            } else {
                newAvailable = codeword | bit;
                for (let i = length - 1; i >= 1; i--) {
                    const av = available[i];
                    if (av !== codeword) break;
                    const b = 1 << (32 - i);
                    if ((av & b) !== 0) {
                        available[i] = available[i - 1];
                        break;
                    }
                    available[i] = av | b;
                }
            }

            available[length] = newAvailable;
            for (let i = length + 1; i <= 32; i++) {
                if (available[i] === codeword) {
                    available[i] = newAvailable;
                }
            }
        }

        // Build Huffman tree
        this.huffmanTree = new Int32Array(8);
        let treeSize = 0;

        for (let entry = 0; entry < this.entries; entry++) {
            const length = this.lengthMap[entry];
            if (length === 0) continue;

            const codeword = codewords[entry];
            let node = 0;

            for (let bit = 0; bit < length; bit++) {
                const mask = 0x80000000 >>> bit;
                if ((codeword & mask) !== 0) {
                    if (this.huffmanTree[node] === 0) {
                        this.huffmanTree[node] = treeSize;
                    }
                    node = this.huffmanTree[node];
                } else {
                    node++;
                }

                if (node >= this.huffmanTree.length) {
                    const newTree = new Int32Array(this.huffmanTree.length * 2);
                    newTree.set(this.huffmanTree);
                    this.huffmanTree = newTree;
                }
            }

            this.huffmanTree[node] = ~entry;
            if (node >= treeSize) {
                treeSize = node + 1;
            }
        }
    }

    /**
     * Decode a single entry from the bitstream
     */
    decodeScalar(reader: VorbisBitReader): number {
        let node = 0;
        while (this.huffmanTree[node] >= 0) {
            node = reader.readBit() !== 0 ? this.huffmanTree[node] : node + 1;
        }
        return ~this.huffmanTree[node];
    }

    /**
     * Decode a vector from the bitstream
     */
    decodeVector(reader: VorbisBitReader): Float32Array | null {
        if (!this.valueVectors) return null;
        return this.valueVectors[this.decodeScalar(reader)];
    }

    /**
     * Calculate number of quantization values for lookup type 1
     */
    private mapType1QuantValues(entries: number, dimensions: number): number {
        let quantValues = Math.floor(Math.pow(entries, 1.0 / dimensions)) + 1;

        while (true) {
            let test = quantValues;
            let dim = dimensions;
            let product = 1;

            while (dim > 1) {
                if ((dim & 1) !== 0) {
                    product *= test;
                }
                test *= test;
                dim >>= 1;
            }

            const result = dim === 1 ? test * product : product;
            if (result <= entries) {
                return quantValues;
            }
            quantValues--;
        }
    }
}
