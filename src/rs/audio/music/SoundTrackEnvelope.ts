import { MusicBuffer } from "./MusicBuffer";

export class SoundTrackEnvelope {
    public numPhases: number = 0;
    public phaseDuration: number[] | null = null;
    public phasePeak: number[] | null = null;
    public smart: number = 0;
    public end: number = 0;
    public form: number = 0;
    public critical: number = 0;
    public phaseIndex: number = 0;
    public __step: number = 0;
    public amplitude: number = 0;
    public ticks: number = 0;

    public decode(buffer: MusicBuffer) {
        this.form = buffer.getUnsignedByte();
        this.smart = buffer.getInt();
        this.end = buffer.getInt();
        this.decodeShape(buffer);
    }

    public decodeShape(buffer: MusicBuffer) {
        this.numPhases = buffer.getUnsignedByte();
        this.phaseDuration = new Array(this.numPhases).fill(0);
        this.phasePeak = new Array(this.numPhases).fill(0);
        for (let phase: number = 0; phase < this.numPhases; phase++) {
            this.phaseDuration[phase] = buffer.getUnsignedLEShort();
            this.phasePeak[phase] = buffer.getUnsignedLEShort();
        }
    }

    public reset() {
        this.critical = 0;
        this.phaseIndex = 0;
        this.__step = 0;
        this.amplitude = 0;
        this.ticks = 0;
    }

    public step(period: number): number {
        if (!this.phaseDuration || !this.phasePeak || this.numPhases <= 0) {
            // No envelope data - return maximum value (unity/pass-through)
            // Returning 0 here was causing notes to be silenced!
            // The envelope should be transparent when not configured.
            return 65535;
        }
        if (this.ticks >= this.critical) {
            this.amplitude = this.phasePeak![this.phaseIndex++] << 15;
            if (this.phaseIndex >= this.numPhases) {
                this.phaseIndex = this.numPhases - 1;
            }
            this.critical =
                (((this.phaseDuration![this.phaseIndex] / 65536.0) * period) as number) | 0;
            if (this.critical > this.ticks) {
                this.__step =
                    (((this.phasePeak![this.phaseIndex] << 15) - this.amplitude) /
                        (this.critical - this.ticks)) |
                    0;
            }
        }
        this.amplitude += this.__step;
        this.ticks++;
        return (this.amplitude - this.__step) >> 15;
    }
}
