import { MusicBuffer } from "./MusicBuffer";
import { SoundTrackInstrument } from "./SoundTrackInstrument";

export class SoundTrack {
    public static tracks: (SoundTrack | null)[] = new Array(5000).fill(null);
    public static trackDelays: number[] = new Array(5000).fill(0);
    public static _buffer: Int8Array | null = null;
    public static buffer: MusicBuffer | null = null;

    public static initialize() {
        if (SoundTrack._buffer) return;
        SoundTrack._buffer = new Int8Array(441000); // 10 seconds buffer? No 441000 bytes. At 22050Hz 8bit mono, that's 20 seconds?
        // The code seems to expand this buffer if needed or reuse it.
        // Actually SoundTrackInstrument.decode() initializes IT'S own buffers.
        SoundTrack.buffer = new MusicBuffer(SoundTrack._buffer);
        SoundTrackInstrument.initialize();
    }

    public static load(buffer: MusicBuffer) {
        SoundTrack.initialize();
        while (true) {
            const trackId: number = buffer.getUnsignedLEShort();
            if (trackId === 65535) {
                return;
            }
            SoundTrack.tracks[trackId] = new SoundTrack();
            SoundTrack.tracks[trackId]!.decode(buffer);
            SoundTrack.trackDelays[trackId] = SoundTrack.tracks[trackId]!.delay();
        }
    }

    public instruments: (SoundTrackInstrument | null)[] = new Array(10).fill(null);
    public loopBegin: number = 0;
    public loopEnd: number = 0;

    public decode(buffer: MusicBuffer) {
        for (let instrument: number = 0; instrument < 10; instrument++) {
            const active: number = buffer.getUnsignedByte();
            if (active !== 0) {
                buffer.currentPosition--;
                this.instruments[instrument] = new SoundTrackInstrument();
                this.instruments[instrument]!.decode(buffer);
            }
        }
        this.loopBegin = buffer.getUnsignedLEShort();
        this.loopEnd = buffer.getUnsignedLEShort();
    }

    public delay(): number {
        let delay: number = 9999999;
        for (let instrument: number = 0; instrument < 10; instrument++) {
            if (
                this.instruments[instrument] != null &&
                ((this.instruments[instrument]!.pauseMillis / 20) | 0) < delay
            ) {
                delay = (this.instruments[instrument]!.pauseMillis / 20) | 0;
            }
        }
        if (this.loopBegin < this.loopEnd && ((this.loopBegin / 20) | 0) < delay) {
            delay = (this.loopBegin / 20) | 0;
        }
        if (delay === 9999999 || delay === 0) {
            return 0;
        }
        for (let instrument: number = 0; instrument < 10; instrument++) {
            if (this.instruments[instrument] != null) {
                this.instruments[instrument]!.pauseMillis -= delay * 20;
            }
        }
        if (this.loopBegin < this.loopEnd) {
            this.loopBegin -= delay * 20;
            this.loopEnd -= delay * 20;
        }
        return delay;
    }

    public encode(loops: number): MusicBuffer {
        SoundTrack.initialize();
        const size: number = this.mix(loops);

        // Ensure buffer exists and is large enough for header + payload
        const needed = size + 44;
        if (!SoundTrack._buffer || SoundTrack._buffer.length < needed) {
            const newBuf = new Int8Array(needed);
            if (SoundTrack._buffer)
                newBuf.set(
                    SoundTrack._buffer.subarray(0, Math.min(SoundTrack._buffer.length, needed)),
                );
            SoundTrack._buffer = newBuf;
            SoundTrack.buffer = new MusicBuffer(SoundTrack._buffer);
        } else {
            // keep existing buffer; reset view
            SoundTrack.buffer = new MusicBuffer(SoundTrack._buffer);
        }

        // Write WAV header into the shared buffer
        SoundTrack.buffer.currentPosition = 0;
        SoundTrack.buffer.putInt(1380533830); // RIFF
        SoundTrack.buffer.putLEInt(36 + size);
        SoundTrack.buffer.putInt(1463899717); // WAVE
        SoundTrack.buffer.putInt(1718449184); // fmt
        SoundTrack.buffer.putLEInt(16);
        SoundTrack.buffer.putLEShort(1);
        SoundTrack.buffer.putLEShort(1);
        SoundTrack.buffer.putLEInt(22050);
        SoundTrack.buffer.putLEInt(22050);
        SoundTrack.buffer.putLEShort(1);
        SoundTrack.buffer.putLEShort(8);
        SoundTrack.buffer.putInt(1684108385); // data
        SoundTrack.buffer.putLEInt(size);

        // Mix wrote PCM starting at offset 44 in _buffer; nothing to copy.
        // Track total bytes written so consumers can slice correctly.
        SoundTrack.buffer.currentPosition = size + 44;
        return SoundTrack.buffer;
    }

    public mix(loops: number): number {
        let millis: number = 0;
        for (let instrument: number = 0; instrument < 10; instrument++) {
            if (
                this.instruments[instrument] != null &&
                this.instruments[instrument]!.soundMillis +
                    this.instruments[instrument]!.pauseMillis >
                    millis
            ) {
                millis =
                    this.instruments[instrument]!.soundMillis +
                    this.instruments[instrument]!.pauseMillis;
            }
        }
        if (millis === 0) {
            return 0;
        }
        let nS: number = ((22050 * millis) / 1000) | 0;
        let loopBegin: number = ((22050 * this.loopBegin) / 1000) | 0;
        let loopEnd: number = ((22050 * this.loopEnd) / 1000) | 0;
        if (
            loopBegin < 0 ||
            loopBegin > nS ||
            loopEnd < 0 ||
            loopEnd > nS ||
            loopBegin >= loopEnd
        ) {
            loops = 0;
        }
        let length: number = nS + (loopEnd - loopBegin) * (loops - 1);

        // Ensure _buffer is allocated and big enough
        if (!SoundTrack._buffer) {
            SoundTrack._buffer = new Int8Array(length + 44 + 10000);
            SoundTrack.buffer = new MusicBuffer(SoundTrack._buffer);
        } else if (SoundTrack._buffer.length < length + 44) {
            const newSize = length + 44 + 10000; // ample room
            const newBuf = new Int8Array(newSize);
            newBuf.set(SoundTrack._buffer!);
            SoundTrack._buffer = newBuf;
            SoundTrack.buffer = new MusicBuffer(SoundTrack._buffer);
        }

        for (let position: number = 44; position < length + 44; position++) {
            SoundTrack._buffer![position] = 0;
        }
        for (let instrument: number = 0; instrument < 10; instrument++) {
            if (this.instruments[instrument] != null) {
                const soundSamples: number =
                    ((this.instruments[instrument]!.soundMillis * 22050) / 1000) | 0;
                const pauseSamples: number =
                    ((this.instruments[instrument]!.pauseMillis * 22050) / 1000) | 0;
                const samples: Int32Array = this.instruments[instrument]!.synthesize(
                    soundSamples,
                    this.instruments[instrument]!.soundMillis,
                );
                for (let soundSample: number = 0; soundSample < soundSamples; soundSample++) {
                    // Java: int var9 = (var7[var8] >> 8) + var3[var8 + var6];
                    let sample: number =
                        (samples[soundSample] >> 8) +
                        SoundTrack._buffer![soundSample + pauseSamples + 44];
                    // Java hard clipping: if ((var9 + 128 & -256) != 0) var9 = var9 >> 31 ^ 127;
                    // Clips signed sample to [-128, 127] range
                    if (((sample + 128) & -256) !== 0) {
                        sample = (sample >> 31) ^ 127;
                    }
                    SoundTrack._buffer![soundSample + pauseSamples + 44] = sample;
                }
            }
        }
        // Convert signed [-128, 127] to unsigned [0, 255] for 8-bit WAV format
        for (let position: number = 44; position < length + 44; position++) {
            SoundTrack._buffer![position] = (SoundTrack._buffer![position] + 128) & 0xff;
        }
        if (loops > 1) {
            loopBegin += 44;
            loopEnd += 44;
            nS += 44;
            let offset: number = (length += 44) - nS;
            for (let position: number = nS - 1; position >= loopEnd; position--) {
                SoundTrack._buffer![position + offset] = SoundTrack._buffer![position];
            }
            for (let loopCounter: number = 1; loopCounter < loops; loopCounter++) {
                offset = (loopEnd - loopBegin) * loopCounter;
                for (let position: number = loopBegin; position < loopEnd; position++) {
                    SoundTrack._buffer![position + offset] = SoundTrack._buffer![position];
                }
            }
            length -= 44;
        }
        return length;
    }
}
