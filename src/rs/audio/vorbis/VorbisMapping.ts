/**
 * Vorbis Mapping (port of VorbisMapping.java).
 * Handles channel mapping and coupling configuration.
 */
import { VorbisBitReader, sharedBitReader } from "./VorbisBitReader";

export class VorbisMapping {
    submaps: number;
    channelMux: number; // Which submap to use for channel 0 (mono)
    floors: Int32Array;
    residues: Int32Array;

    constructor(reader: VorbisBitReader = sharedBitReader) {
        // Mapping type (must be 0)
        reader.readBits(16);

        // Number of submaps
        this.submaps = reader.readFlag() ? reader.readBits(4) + 1 : 1;

        // Coupling steps (unused in mono, skip if present)
        if (reader.readFlag()) {
            reader.readBits(8); // Coupling step count - skip for mono
        }

        // Reserved field
        reader.readBits(2);

        // Channel mux - which submap to use for channel 0
        if (this.submaps > 1) {
            this.channelMux = reader.readBits(4);
        } else {
            this.channelMux = 0;
        }

        // Submap configuration
        this.floors = new Int32Array(this.submaps);
        this.residues = new Int32Array(this.submaps);

        for (let i = 0; i < this.submaps; i++) {
            reader.readBits(8); // Time configuration (unused)
            this.floors[i] = reader.readBits(8);
            this.residues[i] = reader.readBits(8);
        }
    }
}
