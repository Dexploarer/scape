/**
 * Vorbis Floor (port of VorbisFloor.java).
 * Handles spectral floor curve decoding and synthesis.
 */
import { VorbisBitReader, sharedBitReader } from "./VorbisBitReader";
import { VorbisCodebook } from "./VorbisCodebook";
import { iLog } from "./VorbisUtils";

// Decibel lookup table for floor synthesis
const DECIBEL_TABLE = new Float32Array([
    1.0649863e-7, 1.1341951e-7, 1.2079015e-7, 1.2863978e-7, 1.369995e-7, 1.459025e-7, 1.5538409e-7,
    1.6548181e-7, 1.7623574e-7, 1.8768856e-7, 1.998856e-7, 2.128753e-7, 2.2670913e-7, 2.4144197e-7,
    2.5713223e-7, 2.7384212e-7, 2.9163792e-7, 3.1059022e-7, 3.307741e-7, 3.5226967e-7, 3.7516213e-7,
    3.995423e-7, 4.255068e-7, 4.5315863e-7, 4.8260745e-7, 5.1397e-7, 5.4737063e-7, 5.829419e-7,
    6.208247e-7, 6.611694e-7, 7.041359e-7, 7.4989464e-7, 7.98627e-7, 8.505263e-7, 9.057983e-7,
    9.646621e-7, 1.0273513e-6, 1.0941144e-6, 1.1652161e-6, 1.2409384e-6, 1.3215816e-6, 1.4074654e-6,
    1.4989305e-6, 1.5963394e-6, 1.7000785e-6, 1.8105592e-6, 1.9282195e-6, 2.053526e-6, 2.1869757e-6,
    2.3290977e-6, 2.4804558e-6, 2.6416496e-6, 2.813319e-6, 2.9961443e-6, 3.1908505e-6, 3.39821e-6,
    3.619045e-6, 3.8542307e-6, 4.1047006e-6, 4.371447e-6, 4.6555283e-6, 4.958071e-6, 5.280274e-6,
    5.623416e-6, 5.988857e-6, 6.3780467e-6, 6.7925284e-6, 7.2339453e-6, 7.704048e-6, 8.2047e-6,
    8.737888e-6, 9.305725e-6, 9.910464e-6, 1.0554501e-5, 1.1240392e-5, 1.1970856e-5, 1.2748789e-5,
    1.3577278e-5, 1.4459606e-5, 1.5399271e-5, 1.6400005e-5, 1.7465769e-5, 1.8600793e-5,
    1.9809577e-5, 2.1096914e-5, 2.2467912e-5, 2.3928002e-5, 2.5482977e-5, 2.7139005e-5, 2.890265e-5,
    3.078091e-5, 3.2781227e-5, 3.4911533e-5, 3.718028e-5, 3.9596467e-5, 4.2169668e-5, 4.491009e-5,
    4.7828602e-5, 5.0936775e-5, 5.424693e-5, 5.7772202e-5, 6.152657e-5, 6.552491e-5, 6.9783084e-5,
    7.4317984e-5, 7.914758e-5, 8.429104e-5, 8.976875e-5, 9.560242e-5, 1.0181521e-4, 1.0843174e-4,
    1.1547824e-4, 1.2298267e-4, 1.3097477e-4, 1.3948625e-4, 1.4855085e-4, 1.5820454e-4,
    1.6848555e-4, 1.7943469e-4, 1.9109536e-4, 2.0351382e-4, 2.167393e-4, 2.3082423e-4, 2.4582449e-4,
    2.6179955e-4, 2.7881275e-4, 2.9693157e-4, 3.1622787e-4, 3.3677815e-4, 3.5866388e-4,
    3.8197188e-4, 4.0679457e-4, 4.3323037e-4, 4.613841e-4, 4.913675e-4, 5.2329927e-4, 5.573062e-4,
    5.935231e-4, 6.320936e-4, 6.731706e-4, 7.16917e-4, 7.635063e-4, 8.1312325e-4, 8.6596457e-4,
    9.2223985e-4, 9.821722e-4, 0.0010459992, 0.0011139743, 0.0011863665, 0.0012634633, 0.0013455702,
    0.0014330129, 0.0015261382, 0.0016253153, 0.0017309374, 0.0018434235, 0.0019632196,
    0.0020908006, 0.0022266726, 0.0023713743, 0.0025254795, 0.0026895993, 0.0028643848,
    0.0030505287, 0.003248769, 0.0034598925, 0.0036847359, 0.0039241905, 0.0041792067, 0.004450795,
    0.004740033, 0.005048067, 0.0053761187, 0.005725489, 0.0060975635, 0.0064938175, 0.0069158226,
    0.0073652514, 0.007843887, 0.008353627, 0.008896492, 0.009474637, 0.010090352, 0.01074608,
    0.011444421, 0.012188144, 0.012980198, 0.013823725, 0.014722068, 0.015678791, 0.016697686,
    0.017782796, 0.018938422, 0.020169148, 0.021479854, 0.022875736, 0.02436233, 0.025945531,
    0.027631618, 0.029427277, 0.031339627, 0.03337625, 0.035545226, 0.037855156, 0.0403152,
    0.042935107, 0.045725275, 0.048696756, 0.05186135, 0.05523159, 0.05882085, 0.062643364,
    0.06671428, 0.07104975, 0.075666964, 0.08058423, 0.08582105, 0.09139818, 0.097337745, 0.1036633,
    0.11039993, 0.11757434, 0.12521498, 0.13335215, 0.14201812, 0.15124726, 0.16107617, 0.1715438,
    0.18269168, 0.19456401, 0.20720787, 0.22067343, 0.23501402, 0.25028655, 0.26655158, 0.28387362,
    0.3023213, 0.32196787, 0.34289113, 0.36517414, 0.3889052, 0.41417846, 0.44109413, 0.4697589,
    0.50028646, 0.53279793, 0.5674221, 0.6042964, 0.64356697, 0.6853896, 0.72993004, 0.777365,
    0.8278826, 0.88168305, 0.9389798, 1.0,
]);

// Multiplier range values
const MULTIPLIER_RANGE = [256, 128, 86, 64];

export interface VorbisFloorState {
    floor: VorbisFloor;
    active: boolean;
    xList: Int32Array | null;
    yList: Int32Array | null;
    step2Flag: boolean[] | null;
}

export class VorbisFloor {
    partitionClassList: Int32Array;
    multiplier: number;
    classDimensions: Int32Array;
    classSubclasses: Int32Array;
    classMasterbooks: Int32Array;
    subclassBooks: Int32Array[];
    xList: Int32Array;

    private codebooks: VorbisCodebook[];

    constructor(reader: VorbisBitReader = sharedBitReader, codebooks: VorbisCodebook[] = []) {
        this.codebooks = codebooks;

        // Floor type (only type 1 is supported)
        const floorType = reader.readBits(16);
        if (floorType !== 1) {
            throw new Error(`Unsupported floor type: ${floorType}`);
        }

        const partitions = reader.readBits(5);
        let maxClass = -1;

        this.partitionClassList = new Int32Array(partitions);
        for (let i = 0; i < partitions; i++) {
            const classNum = reader.readBits(4);
            this.partitionClassList[i] = classNum;
            if (classNum > maxClass) {
                maxClass = classNum;
            }
        }

        const classCount = maxClass + 1;
        this.classDimensions = new Int32Array(classCount);
        this.classSubclasses = new Int32Array(classCount);
        this.classMasterbooks = new Int32Array(classCount);
        this.subclassBooks = new Array(classCount);

        for (let i = 0; i < classCount; i++) {
            this.classDimensions[i] = reader.readBits(3) + 1;
            const subclasses = reader.readBits(2);
            this.classSubclasses[i] = subclasses;

            if (subclasses !== 0) {
                this.classMasterbooks[i] = reader.readBits(8);
            }

            const subclassCount = 1 << subclasses;
            const books = new Int32Array(subclassCount);
            for (let j = 0; j < subclassCount; j++) {
                books[j] = reader.readBits(8) - 1;
            }
            this.subclassBooks[i] = books;
        }

        this.multiplier = reader.readBits(2) + 1;
        const rangeBits = reader.readBits(4);

        // Build X list
        let xListLength = 2;
        for (let i = 0; i < partitions; i++) {
            xListLength += this.classDimensions[this.partitionClassList[i]];
        }

        this.xList = new Int32Array(xListLength);
        this.xList[0] = 0;
        this.xList[1] = 1 << rangeBits;

        let xIndex = 2;
        for (let i = 0; i < partitions; i++) {
            const classNum = this.partitionClassList[i];
            for (let j = 0; j < this.classDimensions[classNum]; j++) {
                this.xList[xIndex++] = reader.readBits(rangeBits);
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
     * Decode floor configuration from packet
     */
    decodeFloor(reader: VorbisBitReader): VorbisFloorState {
        const active = reader.readFlag();
        if (!active) {
            return { floor: this, active: false, xList: null, yList: null, step2Flag: null };
        }

        const xListLength = this.xList.length;
        const xList = new Int32Array(xListLength);
        const yList = new Int32Array(xListLength);
        const step2Flag = new Array<boolean>(xListLength);

        for (let i = 0; i < xListLength; i++) {
            xList[i] = this.xList[i];
        }

        const range = MULTIPLIER_RANGE[this.multiplier - 1];
        const rangeBits = iLog(range - 1);

        yList[0] = reader.readBits(rangeBits);
        yList[1] = reader.readBits(rangeBits);

        let yIndex = 2;
        for (let i = 0; i < this.partitionClassList.length; i++) {
            const classNum = this.partitionClassList[i];
            const dim = this.classDimensions[classNum];
            const subclasses = this.classSubclasses[classNum];
            const subclassCount = 1 << subclasses;

            let cval = 0;
            if (subclasses > 0) {
                cval = this.codebooks[this.classMasterbooks[classNum]].decodeScalar(reader);
            }

            for (let j = 0; j < dim; j++) {
                const book = this.subclassBooks[classNum][cval & (subclassCount - 1)];
                cval >>>= subclasses;
                yList[yIndex++] = book >= 0 ? this.codebooks[book].decodeScalar(reader) : 0;
            }
        }

        return { floor: this, active: true, xList, yList, step2Flag };
    }

    /**
     * Find low neighbor index
     */
    private lowNeighbor(xList: Int32Array, n: number): number {
        const x = xList[n];
        let bestIdx = -1;
        let bestX = Number.MIN_SAFE_INTEGER;

        for (let i = 0; i < n; i++) {
            const xi = xList[i];
            if (xi < x && xi > bestX) {
                bestIdx = i;
                bestX = xi;
            }
        }

        return bestIdx;
    }

    /**
     * Find high neighbor index
     */
    private highNeighbor(xList: Int32Array, n: number): number {
        const x = xList[n];
        let bestIdx = -1;
        let bestX = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < n; i++) {
            const xi = xList[i];
            if (xi > x && xi < bestX) {
                bestIdx = i;
                bestX = xi;
            }
        }

        return bestIdx;
    }

    /**
     * Linear interpolation for floor curve
     */
    private renderPoint(x0: number, y0: number, x1: number, y1: number, x: number): number {
        const dy = y1 - y0;
        const dx = x1 - x0;
        const adx = dx < 0 ? -dx : dx;
        const ady = dy < 0 ? -dy : dy;
        const err = ady * (x - x0);
        const off = Math.floor(err / dx);
        return dy < 0 ? y0 - off : y0 + off;
    }

    /**
     * Render a line segment onto the floor vector (Bresenham-style interpolation)
     */
    private renderLine(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        v: Float32Array,
        n: number,
    ): void {
        const dy = y1 - y0;
        const dx = x1 - x0;
        // Integer division for base step
        const base = Math.trunc(dy / dx);
        let y = y0;
        let err = 0;
        // abs(dy) - abs(base) * dx
        const absdy = dy < 0 ? -dy : dy;
        const absbase = base < 0 ? -base : base;
        const ady = absdy - absbase * dx;
        // Step direction for error correction
        const sy = dy < 0 ? base - 1 : base + 1;

        v[x0] *= DECIBEL_TABLE[y];
        const limit = x1 > n ? n : x1;

        for (let x = x0 + 1; x < limit; x++) {
            err += ady;
            if (err >= dx) {
                err -= dx;
                y += sy;
            } else {
                y += base;
            }
            v[x] *= DECIBEL_TABLE[y];
        }
    }

    /**
     * Synthesize floor curve into output buffer
     */
    synthesize(state: VorbisFloorState, output: Float32Array, n: number): void {
        if (!state.active || !state.xList || !state.yList || !state.step2Flag) {
            return;
        }

        const xList = state.xList;
        const yList = state.yList;
        const step2Flag = state.step2Flag;
        const range = MULTIPLIER_RANGE[this.multiplier - 1];
        const len = xList.length;

        // Step 2: Amplitude value synthesis
        step2Flag[0] = true;
        step2Flag[1] = true;

        for (let i = 2; i < len; i++) {
            const lowIdx = this.lowNeighbor(xList, i);
            const highIdx = this.highNeighbor(xList, i);
            const predicted = this.renderPoint(
                xList[lowIdx],
                yList[lowIdx],
                xList[highIdx],
                yList[highIdx],
                xList[i],
            );
            const val = yList[i];
            const hiRoom = range - predicted;
            const loRoom = predicted;
            const room = (hiRoom < loRoom ? hiRoom : loRoom) << 1;

            if (val !== 0) {
                step2Flag[lowIdx] = true;
                step2Flag[highIdx] = true;
                step2Flag[i] = true;
                if (val >= room) {
                    // Java: var11 > var9 ? var9 + (var10 - var9) : var11 + (var9 - var10) - 1
                    // = hiRoom > loRoom ? predicted + (val - loRoom) : hiRoom + (predicted - val) - 1
                    // = hiRoom > loRoom ? val : range - val - 1
                    yList[i] =
                        hiRoom > loRoom
                            ? predicted + (val - loRoom)
                            : hiRoom + (predicted - val) - 1;
                } else {
                    yList[i] =
                        (val & 1) !== 0 ? predicted - ((val + 1) >> 1) : (val >> 1) + predicted;
                }
            } else {
                step2Flag[i] = false;
                yList[i] = predicted;
            }
        }

        // Sort by X coordinate
        this.sortByX(xList, yList, step2Flag, 0, len - 1);

        // Render floor curve
        let hx = 0;
        let hy = this.multiplier * yList[0];

        for (let i = 1; i < len; i++) {
            if (step2Flag[i]) {
                const lx = xList[i];
                const ly = this.multiplier * yList[i];
                this.renderLine(hx, hy, lx, ly, output, n);
                if (lx >= n) return;
                hx = lx;
                hy = ly;
            }
        }

        // Fill remaining with last value
        const lastDb = DECIBEL_TABLE[hy];
        for (let x = hx; x < n; x++) {
            output[x] *= lastDb;
        }
    }

    /**
     * Quicksort for floor synthesis
     */
    private sortByX(
        xList: Int32Array,
        yList: Int32Array,
        step2Flag: boolean[],
        left: number,
        right: number,
    ): void {
        if (left >= right) return;

        let pivotIdx = left;
        const pivotX = xList[left];
        const pivotY = yList[left];
        const pivotFlag = step2Flag[left];

        for (let i = left + 1; i <= right; i++) {
            if (xList[i] < pivotX) {
                xList[pivotIdx] = xList[i];
                yList[pivotIdx] = yList[i];
                step2Flag[pivotIdx] = step2Flag[i];
                pivotIdx++;
                xList[i] = xList[pivotIdx];
                yList[i] = yList[pivotIdx];
                step2Flag[i] = step2Flag[pivotIdx];
            }
        }

        xList[pivotIdx] = pivotX;
        yList[pivotIdx] = pivotY;
        step2Flag[pivotIdx] = pivotFlag;

        this.sortByX(xList, yList, step2Flag, left, pivotIdx - 1);
        this.sortByX(xList, yList, step2Flag, pivotIdx + 1, right);
    }
}
