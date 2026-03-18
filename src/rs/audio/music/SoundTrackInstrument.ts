import { MusicBuffer } from "./MusicBuffer";
import { SoundFilter } from "./SoundFilter";
import { SoundTrackEnvelope } from "./SoundTrackEnvelope";

/**
 * Java-compatible Linear Congruential Generator (LCG) random number generator.
 * Matches Java's java.util.Random implementation for deterministic noise generation.
 */
class JavaRandom {
    private static readonly MULTIPLIER = 0x5deece66dn;
    private static readonly ADDEND = 0xbn;
    private static readonly MASK = (1n << 48n) - 1n;
    private seed: bigint;

    constructor(seed: number) {
        this.seed = (BigInt(seed) ^ JavaRandom.MULTIPLIER) & JavaRandom.MASK;
    }

    private next(bits: number): number {
        this.seed = (this.seed * JavaRandom.MULTIPLIER + JavaRandom.ADDEND) & JavaRandom.MASK;
        return Number(this.seed >> BigInt(48 - bits));
    }

    nextInt(): number {
        return this.next(32) | 0;
    }
}

export class SoundTrackInstrument {
    public static buffer: Int32Array;
    public static noise: Int32Array;
    public static sine: Int32Array;
    public static phases: Int32Array = new Int32Array(5);
    public static delays: Int32Array = new Int32Array(5);
    public static volumeStep: Int32Array = new Int32Array(5);
    public static pitchStep: Int32Array = new Int32Array(5);
    public static pitchBaseStep: Int32Array = new Int32Array(5);

    public static initialize() {
        if (SoundTrackInstrument.noise) return;

        // Use seeded random for deterministic noise matching Java's Random(0L)
        // Java: Instrument_noise[i] = (random.nextInt() & 2) - 1
        // This produces values of -1 or 1 based on bit 1 of the random value
        const random = new JavaRandom(0);
        SoundTrackInstrument.noise = new Int32Array(32768);
        for (let i = 0; i < 32768; i++) {
            SoundTrackInstrument.noise[i] = ((random.nextInt() & 2) - 1) | 0;
        }
        SoundTrackInstrument.sine = new Int32Array(32768);
        for (let i = 0; i < 32768; i++) {
            SoundTrackInstrument.sine[i] = (Math.sin(i / 5215.1903) * 16384.0) | 0;
        }
        SoundTrackInstrument.buffer = new Int32Array(220500);
    }

    public pitchEnvelope: SoundTrackEnvelope = new SoundTrackEnvelope();
    public volumeEnvelope: SoundTrackEnvelope = new SoundTrackEnvelope();
    public pitchModEnvelope: SoundTrackEnvelope | null = null;
    public pitchModAmpEnvelope: SoundTrackEnvelope | null = null;
    public volumeModEnvelope: SoundTrackEnvelope | null = null;
    public volumeModAmpEnvelope: SoundTrackEnvelope | null = null;
    public gatingReleaseEnvelope: SoundTrackEnvelope | null = null;
    public gatingAttackEnvelope: SoundTrackEnvelope | null = null;

    public oscillVolume: number[] = [0, 0, 0, 0, 0];
    public oscillPitchDelta: number[] = [0, 0, 0, 0, 0];
    public oscillDelay: number[] = [0, 0, 0, 0, 0];

    public delayTime: number = 0;
    public delayFeedback: number = 100;

    public filter: SoundFilter | null = null;
    public filterEnvelope: SoundTrackEnvelope | null = null;

    public soundMillis: number = 500;
    public pauseMillis: number = 0;

    public synthesize(nS: number, dt: number): Int32Array {
        SoundTrackInstrument.buffer.fill(0, 0, nS);

        if (dt < 10) {
            return SoundTrackInstrument.buffer;
        }

        const fS: number = nS / (dt + 0.0);

        this.pitchEnvelope.reset();
        this.volumeEnvelope.reset();

        let pitchModStep: number = 0;
        let pitchModBaseStep: number = 0;
        let pitchModPhase: number = 0;

        if (this.pitchModEnvelope != null) {
            this.pitchModEnvelope.reset();
            this.pitchModAmpEnvelope!.reset();
            pitchModStep =
                ((((this.pitchModEnvelope.end - this.pitchModEnvelope.smart) * 32.768) /
                    fS) as number) | 0;
            pitchModBaseStep = (((this.pitchModEnvelope.smart * 32.768) / fS) as number) | 0;
        }

        let volumeModStep: number = 0;
        let volumeModBaseStep: number = 0;
        let volumeModPhase: number = 0;

        if (this.volumeModEnvelope != null) {
            this.volumeModEnvelope.reset();
            this.volumeModAmpEnvelope!.reset();
            volumeModStep =
                ((((this.volumeModEnvelope.end - this.volumeModEnvelope.smart) * 32.768) /
                    fS) as number) | 0;
            volumeModBaseStep = (((this.volumeModEnvelope.smart * 32.768) / fS) as number) | 0;
        }

        for (let oscillVolumeId: number = 0; oscillVolumeId < 5; oscillVolumeId++) {
            if (this.oscillVolume[oscillVolumeId] !== 0) {
                SoundTrackInstrument.phases[oscillVolumeId] = 0;
                SoundTrackInstrument.delays[oscillVolumeId] =
                    ((this.oscillDelay[oscillVolumeId] * fS) as number) | 0;
                SoundTrackInstrument.volumeStep[oscillVolumeId] =
                    ((this.oscillVolume[oscillVolumeId] << 14) / 100) | 0;
                SoundTrackInstrument.pitchStep[oscillVolumeId] =
                    ((((this.pitchEnvelope.end - this.pitchEnvelope.smart) *
                        32.768 *
                        Math.pow(1.0057929410678534, this.oscillPitchDelta[oscillVolumeId])) /
                        fS) as number) | 0;
                SoundTrackInstrument.pitchBaseStep[oscillVolumeId] =
                    (((this.pitchEnvelope.smart * 32.768) / fS) as number) | 0;
            }
        }

        for (let offset: number = 0; offset < nS; offset++) {
            let pitchChange: number = this.pitchEnvelope.step(nS);
            let volumeChange: number = this.volumeEnvelope.step(nS);

            if (this.pitchModEnvelope != null) {
                const mod: number = this.pitchModEnvelope.step(nS);
                const modAmp: number = this.pitchModAmpEnvelope!.step(nS);
                pitchChange +=
                    this.evaluateWave(modAmp, pitchModPhase, this.pitchModEnvelope.form) >> 1;
                pitchModPhase += ((mod * pitchModStep) >> 16) + pitchModBaseStep;
            }

            if (this.volumeModEnvelope != null) {
                const mod: number = this.volumeModEnvelope.step(nS);
                const modAmp: number = this.volumeModAmpEnvelope!.step(nS);
                volumeChange =
                    (volumeChange *
                        ((this.evaluateWave(modAmp, volumeModPhase, this.volumeModEnvelope.form) >>
                            1) +
                            32768)) >>
                    15;
                volumeModPhase += ((mod * volumeModStep) >> 16) + volumeModBaseStep;
            }

            for (let oscillVolumeId: number = 0; oscillVolumeId < 5; oscillVolumeId++) {
                if (this.oscillVolume[oscillVolumeId] !== 0) {
                    const position: number = offset + SoundTrackInstrument.delays[oscillVolumeId];
                    if (position < nS) {
                        SoundTrackInstrument.buffer[position] += this.evaluateWave(
                            (volumeChange * SoundTrackInstrument.volumeStep[oscillVolumeId]) >> 15,
                            SoundTrackInstrument.phases[oscillVolumeId],
                            this.pitchEnvelope.form,
                        );
                        SoundTrackInstrument.phases[oscillVolumeId] +=
                            ((pitchChange * SoundTrackInstrument.pitchStep[oscillVolumeId]) >> 16) +
                            SoundTrackInstrument.pitchBaseStep[oscillVolumeId];
                    }
                }
            }
        }

        if (this.gatingReleaseEnvelope != null) {
            this.gatingReleaseEnvelope.reset();
            this.gatingAttackEnvelope!.reset();
            let counter: number = 0;
            let muted: boolean = true;
            for (let position: number = 0; position < nS; position++) {
                const onStep: number = this.gatingReleaseEnvelope.step(nS);
                const offStep: number = this.gatingAttackEnvelope!.step(nS);
                let threshold: number;
                if (muted) {
                    threshold =
                        this.gatingReleaseEnvelope.smart +
                        (((this.gatingReleaseEnvelope.end - this.gatingReleaseEnvelope.smart) *
                            onStep) >>
                            8);
                } else {
                    threshold =
                        this.gatingReleaseEnvelope.smart +
                        (((this.gatingReleaseEnvelope.end - this.gatingReleaseEnvelope.smart) *
                            offStep) >>
                            8);
                }
                if ((counter += 256) >= threshold) {
                    counter = 0;
                    muted = !muted;
                }
                if (muted) {
                    SoundTrackInstrument.buffer[position] = 0;
                }
            }
        }

        if (this.delayTime > 0 && this.delayFeedback > 0) {
            const delay: number = ((this.delayTime * fS) as number) | 0;
            for (let position: number = delay; position < nS; position++) {
                SoundTrackInstrument.buffer[position] +=
                    ((SoundTrackInstrument.buffer[position - delay] * this.delayFeedback) / 100) |
                    0;
            }
        }

        if (this.filter && (this.filter.numPairs[0] > 0 || this.filter.numPairs[1] > 0)) {
            this.filterEnvelope!.reset();
            let t: number = this.filterEnvelope!.step(nS + 1);
            let M: number = this.filter.compute(0, Math.fround(t / 65536.0));
            let N: number = this.filter.compute(1, Math.fround(t / 65536.0));

            if (nS >= M + N) {
                let n: number = 0;
                let delay: number = N;
                if (delay > nS - M) {
                    delay = nS - M;
                }

                const processFilter = () => {
                    let y: number =
                        (SoundTrackInstrument.buffer[n + M] * SoundFilter.invUnity) >> 16;
                    for (let position: number = 0; position < M; position++) {
                        y +=
                            (SoundTrackInstrument.buffer[n + M - 1 - position] *
                                SoundFilter.coefficient[0][position]) >>
                            16;
                    }
                    for (let position: number = 0; position < n; position++) {
                        y -=
                            (SoundTrackInstrument.buffer[n - 1 - position] *
                                SoundFilter.coefficient[1][position]) >>
                            16;
                    }
                    SoundTrackInstrument.buffer[n] = y;
                    t = this.filterEnvelope!.step(nS + 1);
                };

                for (; n < delay; n++) {
                    processFilter();
                }

                // The original code had a weird do-while loop with unicode characters for 128
                // It seems to be chunking the processing.
                const chunkSize = 128;
                delay = chunkSize;

                while (true) {
                    if (delay > nS - M) {
                        delay = nS - M;
                    }
                    for (; n < delay; n++) {
                        processFilter();
                    }
                    if (n >= nS - M) break;

                    M = this.filter.compute(0, Math.fround(t / 65536.0));
                    N = this.filter.compute(1, Math.fround(t / 65536.0));
                    delay += chunkSize;
                }

                for (; n < nS; n++) {
                    let y: number = 0;
                    for (let position: number = n + M - nS; position < M; position++) {
                        y +=
                            (SoundTrackInstrument.buffer[n + M - 1 - position] *
                                SoundFilter.coefficient[0][position]) >>
                            16;
                    }
                    for (let position: number = 0; position < N; position++) {
                        y -=
                            (SoundTrackInstrument.buffer[n - 1 - position] *
                                SoundFilter.coefficient[1][position]) >>
                            16;
                    }
                    SoundTrackInstrument.buffer[n] = y;
                    this.filterEnvelope!.step(nS + 1);
                }
            }
        }

        for (let position: number = 0; position < nS; position++) {
            if (SoundTrackInstrument.buffer[position] < -32768) {
                SoundTrackInstrument.buffer[position] = -32768;
            }
            if (SoundTrackInstrument.buffer[position] > 32767) {
                SoundTrackInstrument.buffer[position] = 32767;
            }
        }
        return SoundTrackInstrument.buffer;
    }

    public evaluateWave(amplitude: number, phase: number, table: number): number {
        if (table === 1) {
            if ((phase & 32767) < 16384) {
                return amplitude;
            } else {
                return -amplitude;
            }
        }
        if (table === 2) {
            return (SoundTrackInstrument.sine[phase & 32767] * amplitude) >> 14;
        }
        if (table === 3) {
            return (((phase & 32767) * amplitude) >> 14) - amplitude;
        }
        if (table === 4) {
            return SoundTrackInstrument.noise[((phase / 2607) | 0) & 32767] * amplitude;
        } else {
            return 0;
        }
    }

    public decode(buffer: MusicBuffer) {
        this.pitchEnvelope = new SoundTrackEnvelope();
        this.pitchEnvelope.decode(buffer);
        this.volumeEnvelope = new SoundTrackEnvelope();
        this.volumeEnvelope.decode(buffer);

        let option: number = buffer.getUnsignedByte();
        if (option !== 0) {
            buffer.currentPosition--;
            this.pitchModEnvelope = new SoundTrackEnvelope();
            this.pitchModEnvelope.decode(buffer);
            this.pitchModAmpEnvelope = new SoundTrackEnvelope();
            this.pitchModAmpEnvelope.decode(buffer);
        }

        option = buffer.getUnsignedByte();
        if (option !== 0) {
            buffer.currentPosition--;
            this.volumeModEnvelope = new SoundTrackEnvelope();
            this.volumeModEnvelope.decode(buffer);
            this.volumeModAmpEnvelope = new SoundTrackEnvelope();
            this.volumeModAmpEnvelope.decode(buffer);
        }

        option = buffer.getUnsignedByte();
        if (option !== 0) {
            buffer.currentPosition--;
            this.gatingReleaseEnvelope = new SoundTrackEnvelope();
            this.gatingReleaseEnvelope.decode(buffer);
            this.gatingAttackEnvelope = new SoundTrackEnvelope();
            this.gatingAttackEnvelope.decode(buffer);
        }

        for (let oscillId: number = 0; oscillId < 10; oscillId++) {
            const volume: number = buffer.getSmart();
            if (volume === 0) {
                break;
            }
            this.oscillVolume[oscillId] = volume;
            this.oscillPitchDelta[oscillId] = buffer.getSignedSmart();
            this.oscillDelay[oscillId] = buffer.getSmart();
        }

        this.delayTime = buffer.getSmart();
        this.delayFeedback = buffer.getSmart();
        this.soundMillis = buffer.getUnsignedLEShort();
        this.pauseMillis = buffer.getUnsignedLEShort();

        this.filter = new SoundFilter();
        this.filterEnvelope = new SoundTrackEnvelope();
        this.filter.decode(this.filterEnvelope, buffer);
    }
}
