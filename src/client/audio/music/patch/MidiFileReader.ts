import { ByteBuffer } from "../../../../rs/io/ByteBuffer";

export type MidiEvent =
    | { type: "tempo"; microsecPerQuarter: number; tick: number }
    | { type: "noteOn"; channel: number; key: number; velocity: number; tick: number }
    | { type: "noteOff"; channel: number; key: number; velocity: number; tick: number };

/**
 * Minimal MIDI parser for OSRS cache music tracks.
 * Based on RuneLite MidiFileReader but simplified to emit note/tempo events.
 */
export class MidiFileReader {
    division = 0;
    private trackOffsets: number[] = [];
    private trackPositions: number[] = [];
    private trackLengths: number[] = [];
    private runningStatus: number[] = [];
    private buffer: ByteBuffer = new ByteBuffer(0);

    parse(data: Uint8Array): void {
        this.buffer = new ByteBuffer(data);
        this.buffer.offset = 10;
        const trackCount = this.buffer.readUnsignedShort();
        this.division = this.buffer.readUnsignedShort();
        this.trackOffsets = new Array(trackCount);
        for (let i = 0; i < trackCount; i++) {
            const chunkType = this.buffer.readInt();
            const length = this.buffer.readInt();
            if (chunkType === 0x4d54726b) {
                this.trackOffsets[i] = this.buffer.offset;
                this.buffer.offset += length;
            } else {
                this.buffer.offset += length;
                i--;
            }
        }
        this.trackPositions = [...this.trackOffsets];
        this.trackLengths = new Array(trackCount).fill(0);
        this.runningStatus = new Array(trackCount).fill(0);
    }

    readEvents(): MidiEvent[] {
        const events: MidiEvent[] = [];
        const ticks = [...this.trackLengths];
        let finishedTracks = 0;
        const trackCount = this.trackPositions.length;
        while (finishedTracks < trackCount) {
            // Pick next track with smallest tick
            let minTick = Number.MAX_SAFE_INTEGER;
            let track = -1;
            for (let t = 0; t < trackCount; t++) {
                if (this.trackPositions[t] >= 0 && ticks[t] < minTick) {
                    minTick = ticks[t];
                    track = t;
                }
            }
            if (track === -1) break;
            this.buffer.offset = this.trackPositions[track];
            let delta: number;
            try {
                delta = this.buffer.readVarInt();
            } catch {
                // Corrupt track; abort
                this.trackPositions[track] = -1;
                finishedTracks++;
                continue;
            }
            ticks[track] += delta;
            const statusByte = this.buffer._data[this.buffer.offset] & 0xff;
            let status = statusByte;
            if (status < 0x80) {
                // running status
                status = this.runningStatus[track];
            } else {
                this.buffer.offset++;
                this.runningStatus[track] = status;
            }
            if (status === 0xff) {
                const metaType = this.buffer.readUnsignedByte();
                const len = this.buffer.readVarInt();
                if (metaType === 0x2f) {
                    this.buffer.offset += len;
                    this.trackPositions[track] = -1;
                    finishedTracks++;
                    continue;
                } else if (metaType === 0x51 && len === 3) {
                    const tempo = this.buffer.readMedium();
                    events.push({ type: "tempo", microsecPerQuarter: tempo, tick: ticks[track] });
                } else {
                    this.buffer.offset += len;
                }
            } else if ((status & 0xf0) === 0x90 || (status & 0xf0) === 0x80) {
                const key = this.buffer.readUnsignedByte();
                const velocity = this.buffer.readUnsignedByte();
                const channel = status & 0x0f;
                if ((status & 0xf0) === 0x90 && velocity > 0) {
                    events.push({ type: "noteOn", channel, key, velocity, tick: ticks[track] });
                } else {
                    events.push({ type: "noteOff", channel, key, velocity, tick: ticks[track] });
                }
            } else {
                // skip other messages
                const midiClass = status & 0xf0;
                const dataBytes = midiClass === 0xc0 || midiClass === 0xd0 ? 1 : 2;
                this.buffer.offset += dataBytes;
            }
            this.trackPositions[track] = this.buffer.offset;
        }
        return events;
    }
}
