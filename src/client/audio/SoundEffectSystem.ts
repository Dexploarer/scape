import { SoundEffectLoader } from "../../rs/audio/SoundEffectLoader";
import type { RawSoundData } from "../../rs/audio/legacy/SoundEffect";
import type { SeqSoundEffect } from "../../rs/config/seqtype/SeqType";
import { addAudioContextResumeListeners, getAudioContextConstructor } from "./audioContext";
import { resampleToSampleRate, smoothLowPass } from "./resample";

type DecodedSound = {
    sampleRate: number;
    channelData: Float32Array;
    duration: number;
};

const enum DistanceFadeCurve {
    LINEAR = 0,
    QUADRATIC = 1,
    CUBIC = 2,
    EXPONENTIAL = 3,
}

export interface PlaySoundOptions {
    loops?: number;
    delayMs?: number;
    position?: { x: number; y: number; z?: number };
    radius?: number;
    distanceFadeCurve?: number;
    isLocalPlayer?: boolean;
    /** SOUND_AREA volume (0-255, default 255 = full volume) */
    volume?: number;
}

export interface SequenceSoundContext {
    position?: { x: number; y: number; z?: number };
    isLocalPlayer?: boolean;
    distanceFadeCurve?: number;
    radiusOverride?: number;
    // Debug-only metadata for one-line logging
    debugSeqId?: number;
    debugFrame?: number;
}

export interface AmbientSoundInstance {
    locId: number;
    soundId: number;
    x: number;
    y: number;
    z: number;
    distance: number;
    changeTicksMin: number;
    changeTicksMax: number;
    soundIds?: number[];
    retainTicks?: number;
    fadeInDurationMs?: number;
    fadeOutDurationMs?: number;
    fadeInCurve?: number;
    fadeOutCurve?: number;
    distanceFadeCurve?: number;
    distanceOverride?: number;
    loopSequentially?: boolean;
    deferSwap?: boolean;
    exactPosition?: boolean;
    resetOnLoop?: boolean;
}

type ActiveAmbientSound = {
    instance: AmbientSoundInstance;
    gainNode: GainNode;
    loopSource?: AudioBufferSourceNode;
    loopSoundId?: number;
    overlaySource?: AudioBufferSourceNode;
    nextChangeTime: number;
    currentSoundIndex: number;
    stopAt?: number;
    fadeOutActive?: boolean;
    fadeInDurationSec: number;
    fadeOutDurationSec: number;
    retainDurationSec: number;
};

const TICK_LENGTH_SECONDS = 0.6;

export class SoundEffectSystem {
    private readonly decodedCache = new Map<string, DecodedSound>();
    private readonly loader: SoundEffectLoader;
    private context: AudioContext | undefined;
    private gainNode: GainNode | undefined;
    private ambientGainNode: GainNode | undefined;
    private masterVolume = 1.0;
    private ambientVolume = 1.0; // Separate volume for area/ambient sounds
    private readonly activeSources: AudioBufferSourceNode[] = [];
    private readonly maxSimultaneous = 32;
    private readonly lastPlayed = new Map<string, number>();
    private readonly ambientSounds = new Map<string, ActiveAmbientSound>();
    private listenerX = 0;
    private listenerY = 0;
    private listenerZ = 0;
    private readonly warnedSounds = new Set<number>();
    // Memory leak fix: track context resume listener cleanup
    private contextResumeCleanup: (() => void) | null = null;
    private readonly MAX_CACHE_SIZE = 100;

    constructor(loader: SoundEffectLoader) {
        this.loader = loader;
    }

    updateListenerPosition(x: number, y: number, z: number): void {
        this.listenerX = x;
        this.listenerY = y;
        this.listenerZ = z;
    }

    setVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.masterVolume;
        }
    }

    /**
     * Set the volume multiplier for ambient/area sounds.
     * This is separate from the master sound effect volume.
     * @param volume Volume level from 0.0 to 1.0
     */
    setAmbientVolume(volume: number): void {
        this.ambientVolume = Math.max(0, Math.min(1, volume));
        if (this.ambientGainNode) {
            this.ambientGainNode.gain.value = this.ambientVolume;
        }
    }

    private ensureContext(): AudioContext | undefined {
        if (typeof window === "undefined") return undefined;
        if (this.context) {
            // Resume suspended context on subsequent calls (after user gesture)
            if (this.context.state === "suspended") {
                this.context.resume().catch(() => {});
            }
            return this.context;
        }
        const AudioCtx = getAudioContextConstructor();
        if (!AudioCtx) return undefined;
        const ctx = new AudioCtx();
        // Master gain node for regular sound effects
        const gain = ctx.createGain();
        gain.gain.value = this.masterVolume;
        gain.connect(ctx.destination);
        this.context = ctx;
        this.gainNode = gain;
        // Separate gain node for ambient/area sounds
        const ambientGain = ctx.createGain();
        ambientGain.gain.value = this.ambientVolume;
        ambientGain.connect(ctx.destination);
        this.ambientGainNode = ambientGain;

        // Auto-resume on user interaction (required by browser autoplay policy)
        if (!this.contextResumeCleanup) {
            this.contextResumeCleanup = addAudioContextResumeListeners(ctx, () => {
                this.contextResumeCleanup = null;
            });
        }

        return ctx;
    }

    private removeContextListeners(): void {
        if (this.contextResumeCleanup) {
            const cleanup = this.contextResumeCleanup;
            this.contextResumeCleanup = null;
            cleanup();
        }
    }

    private cacheKey(soundId: number, sampleRate: number): string {
        return `${soundId}@${sampleRate}`;
    }

    private decode(
        soundId: number,
        targetSampleRate?: number,
        forceResample = false,
    ): DecodedSound | undefined {
        const ctx = this.context;
        const effectiveRate =
            forceResample && ctx
                ? ctx.sampleRate
                : typeof targetSampleRate === "number"
                ? targetSampleRate
                : 0;
        const cacheKey = this.cacheKey(soundId, effectiveRate);
        const cached = this.decodedCache.get(cacheKey);
        if (cached) return cached;

        const t0 = performance.now();
        const raw = this.loader.load(soundId);
        if (!raw) return undefined;
        const t1 = performance.now();

        const decoded = this.toFloatData(raw, effectiveRate);
        const t2 = performance.now();

        // Only log issues once per sound ID to avoid spam
        if (decoded.channelData.length === 0) {
            if (!this.warnedSounds.has(soundId)) {
                this.warnedSounds.add(soundId);
                console.warn(`[SoundEffectSystem] Sound ${soundId} produced empty output`);
            }
        }

        this.decodedCache.set(cacheKey, decoded);

        // Memory leak fix: evict oldest entries if cache too large
        if (this.decodedCache.size > this.MAX_CACHE_SIZE) {
            const keysToDelete = Array.from(this.decodedCache.keys()).slice(
                0,
                this.decodedCache.size - this.MAX_CACHE_SIZE,
            );
            for (const key of keysToDelete) {
                this.decodedCache.delete(key);
            }
        }

        return decoded;
    }

    private toFloatData(raw: RawSoundData, targetSampleRate: number): DecodedSound {
        // Handle start/end trimming if specified
        const total = raw.samples.length | 0;
        let startSample = Math.max(0, Math.min(total, Math.floor(raw.start)));
        let rawEnd = raw.end > 0 ? Math.floor(raw.end) : total;
        let endSample = Math.max(0, Math.min(total, rawEnd));
        // If markers are inverted or equal, treat as full buffer to avoid zero-length output
        if (endSample <= startSample) {
            startSample = 0;
            endSample = total;
        }
        const length = endSample - startSample;

        // Safety check: only reject empty slices; allow very short FX
        if (length <= 0) {
            console.warn("[SoundEffectSystem] Rejecting very short sound with length", length);
            return {
                sampleRate: raw.sampleRate || targetSampleRate || 22050,
                channelData: new Float32Array(0),
                duration: 0,
            };
        }

        let channel = new Float32Array(length);
        let hasExtremeJumps = false;
        let maxJump = 0;

        for (let i = 0; i < length; i++) {
            // Int8 ranges from -128 to 127
            // Convert to float range -1.0 to 1.0
            const sample = raw.samples[startSample + i];
            channel[i] = sample / 128.0; // Symmetric conversion

            // Check for extreme jumps in the source data
            if (i > 0) {
                const jump = Math.abs(
                    raw.samples[startSample + i] - raw.samples[startSample + i - 1],
                );
                if (jump > maxJump) maxJump = jump;
                if (jump > 50) hasExtremeJumps = true;
            }
        }

        let output = channel;
        let outputRate = raw.sampleRate;

        if (targetSampleRate > 0 && targetSampleRate !== raw.sampleRate) {
            // Apply anti-aliasing filter BEFORE upsampling
            if (targetSampleRate > raw.sampleRate) {
                const nyquist = raw.sampleRate / 2;
                smoothLowPass(channel, raw.sampleRate, nyquist * 0.9); // Cut off at 90% of Nyquist
            }

            output = resampleToSampleRate(channel, raw.sampleRate, targetSampleRate);
            outputRate = targetSampleRate;

            // Apply smoothing filter AFTER resampling
            smoothLowPass(output, outputRate);

            // Check and fix loop boundary discontinuities for looping sounds
            const loopJump = Math.abs(output[output.length - 1] - output[0]);
            if (loopJump > 0.02) {
                // Apply crossfade at loop boundary to eliminate clicks
                const crossfadeLength = Math.min(2205, Math.floor(output.length * 0.05)); // 50ms crossfade
                for (let i = 0; i < crossfadeLength; i++) {
                    const fadeOut = 1.0 - i / crossfadeLength;
                    const fadeIn = i / crossfadeLength;
                    const endPos = output.length - crossfadeLength + i;
                    output[endPos] = output[endPos] * fadeOut + output[i] * fadeIn;
                }
            }
        } else {
            // Apply gentle low-pass filter even without resampling
            smoothLowPass(output, outputRate);
        }

        return {
            sampleRate: outputRate,
            channelData: output,
            duration: output.length / outputRate,
        };
    }

    private prepareBuffer(
        sound: DecodedSound,
        ctx: AudioContext,
        applyLoopCrossfade = false,
    ): AudioBuffer {
        const length = sound.channelData.length;
        const buffer = ctx.createBuffer(1, length, sound.sampleRate);
        const data = sound.channelData.slice(); // Clone to avoid modifying cache
        buffer.copyToChannel(data, 0);
        return buffer;
    }

    private registerSource(source: AudioBufferSourceNode, extraNodes: AudioNode[] = []): void {
        this.activeSources.push(source);
        source.addEventListener("ended", () => {
            const idx = this.activeSources.indexOf(source);
            if (idx >= 0) this.activeSources.splice(idx, 1);
            this.disconnectNodes(extraNodes);
        });
        if (this.activeSources.length > this.maxSimultaneous) {
            const oldest = this.activeSources.shift();
            try {
                oldest?.stop();
            } catch {}
        }
    }

    private disconnectNodes(nodes: AudioNode[] = []) {
        for (const node of nodes) {
            try {
                node.disconnect();
            } catch {}
        }
    }

    playSoundEffect(soundId: number, options: PlaySoundOptions = {}): void {
        const ctx = this.ensureContext();
        if (!ctx || !this.loader.available()) return;

        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const decoded = this.decode(soundId);
        if (!decoded) return;
        if (!decoded.channelData || decoded.channelData.length === 0 || decoded.sampleRate <= 0) {
            // As a last-resort safety net, synthesize a tiny click to avoid errors and keep timing consistent
            const contextSampleRate =
                this.context && typeof this.context.sampleRate === "number"
                    ? this.context.sampleRate
                    : 22050;
            const sr = Math.max(22050, contextSampleRate);
            const tmp: DecodedSound = {
                sampleRate: sr,
                channelData: new Float32Array(Math.max(64, Math.floor(sr * 0.02))).fill(0),
                duration: 0.02,
            };
            // tiny DC-pop-safe blip
            for (let i = 0; i < tmp.channelData.length; i++)
                tmp.channelData[i] = Math.sin((i / tmp.channelData.length) * Math.PI) * 0.001;
            const buffer = this.prepareBuffer(tmp, ctx);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            if (!this.gainNode) {
                this.gainNode = ctx.createGain();
                this.gainNode.gain.value = this.masterVolume;
                this.gainNode.connect(ctx.destination);
            }
            source.connect(this.gainNode);
            source.start(ctx.currentTime + (options.delayMs ? options.delayMs / 1000 : 0));
            this.registerSource(source);
            return;
        }

        const buffer = this.prepareBuffer(decoded, ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        if (!this.gainNode) {
            this.gainNode = ctx.createGain();
            this.gainNode.gain.value = this.masterVolume;
            this.gainNode.connect(ctx.destination);
        }

        let gainMultiplier = 1.0;
        const radius = options.radius;
        const position = options.position;
        let gainNode: GainNode | undefined;

        // SOUND_AREA volume: 0-255 where 255 = full volume
        const volumeRaw = typeof options.volume === "number" ? options.volume : 255;
        const volumeMultiplier = Math.max(0, Math.min(1, volumeRaw / 255));

        if (radius !== undefined) {
            if (radius <= 0) {
                if (!options.isLocalPlayer) {
                    return;
                }
            } else {
                if (!position) {
                    return;
                }
                const dx = Math.abs(position.x - this.listenerX);
                const dy = Math.abs(position.y - this.listenerY);
                const manhattan = Math.max(0, dx + dy - 128);
                if (manhattan > radius) {
                    return;
                }
                gainMultiplier = this.computeDistanceGain(
                    manhattan,
                    radius,
                    options.distanceFadeCurve !== undefined
                        ? options.distanceFadeCurve
                        : DistanceFadeCurve.LINEAR,
                );
            }
        }

        // Apply both distance attenuation and SOUND_AREA volume
        const finalGain = gainMultiplier * volumeMultiplier;

        if (radius !== undefined || volumeMultiplier < 1) {
            gainNode = ctx.createGain();
            gainNode.gain.value = finalGain;
            gainNode.connect(this.gainNode);
            source.connect(gainNode);
        } else {
            source.connect(this.gainNode);
        }

        const startTime = ctx.currentTime + (options.delayMs ? options.delayMs / 1000 : 0);

        const requestedLoops = typeof options.loops === "number" ? options.loops : 1;
        const normalizedLoops = Math.max(0, requestedLoops | 0);

        if (normalizedLoops === 0) {
            // Treat 0 as a continuous loop (matches RawPcmStream.setNumLoops(-1) in RS client)
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
            source.start(startTime);
        } else if (normalizedLoops === 1) {
            source.start(startTime);
        } else {
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
            source.start(startTime);
            source.stop(startTime + buffer.duration * normalizedLoops);
        }

        this.registerSource(source, gainNode ? [gainNode] : []);
    }

    handleSeqFrameSounds(effects: SeqSoundEffect[], context?: SequenceSoundContext): void {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        for (const effect of effects) {
            const radiusTiles = typeof effect.location === "number" ? effect.location : 0;
            const loopsRaw = typeof effect.loops === "number" ? effect.loops : 1;
            const loops = loopsRaw <= 0 ? 0 : loopsRaw;

            const locationKey =
                context?.position != null
                    ? `${effect.id}:${Math.round(context.position.x / 128)}:${Math.round(
                          context.position.y / 128,
                      )}`
                    : `${effect.id}`;
            const lastPlayed = this.lastPlayed.get(locationKey);
            const last = typeof lastPlayed === "number" ? lastPlayed : 0;
            if (now - last < 20) continue;
            this.lastPlayed.set(locationKey, now);

            const radiusOverride = context?.radiusOverride;
            const radiusScene =
                radiusOverride !== undefined
                    ? radiusOverride
                    : radiusTiles > 0
                    ? radiusTiles * 128
                    : undefined;

            this.playSoundEffect(effect.id, {
                loops,
                position: context?.position,
                radius: radiusScene,
                distanceFadeCurve: context?.distanceFadeCurve,
                isLocalPlayer: context?.isLocalPlayer,
            });
        }
    }

    updateAmbientSounds(instances: AmbientSoundInstance[]): void {
        const ctx = this.ensureContext();
        if (!ctx || !this.loader.available()) return;

        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const activeKeys = new Set<string>();

        // Process each ambient sound instance
        for (const instance of instances) {
            const key = this.ambientKey(instance);
            activeKeys.add(key);

            // All waterfall sounds should now work properly with loop crossfading

            const existing = this.ambientSounds.get(key);
            const dx = Math.abs(instance.x - this.listenerX);
            const dy = Math.abs(instance.y - this.listenerY);
            const manhattan = Math.max(0, dx + dy - 128);
            const distanceTiles =
                instance.distanceOverride !== undefined && instance.distanceOverride >= 0
                    ? instance.distanceOverride
                    : instance.distance;
            const maxDist = Math.max(0, distanceTiles * 128);

            if (maxDist === 0 && manhattan > 0) {
                if (existing) {
                    this.stopAmbientSound(key, ctx);
                }
                continue;
            }

            if (maxDist > 0 && manhattan > maxDist) {
                if (existing) {
                    this.beginAmbientFadeOut(key, existing, ctx, now);
                }
                continue;
            }

            const volume = this.computeDistanceGain(
                manhattan,
                maxDist,
                instance.distanceFadeCurve !== undefined
                    ? instance.distanceFadeCurve
                    : DistanceFadeCurve.LINEAR,
            );

            if (existing) {
                // Update existing sound
                existing.fadeInDurationSec = Math.max(
                    0,
                    (typeof instance.fadeInDurationMs === "number"
                        ? instance.fadeInDurationMs
                        : 0) / 1000,
                );
                existing.fadeOutDurationSec = Math.max(
                    0,
                    (typeof instance.fadeOutDurationMs === "number"
                        ? instance.fadeOutDurationMs
                        : 0) / 1000,
                );
                existing.retainDurationSec = Math.max(
                    0,
                    (typeof instance.retainTicks === "number" ? instance.retainTicks : 0) *
                        TICK_LENGTH_SECONDS,
                );
                existing.fadeOutActive = false;
                existing.stopAt = undefined;

                // Scale volume based on number of active sounds to prevent clipping
                // Note: ambient sounds go through ambientGainNode which applies the user's area sound volume
                const activeSoundCount = this.ambientSounds.size;
                const volumeScale = activeSoundCount > 1 ? 1 / Math.sqrt(activeSoundCount) : 1;
                const targetGain = volume * volumeScale;

                this.adjustAmbientGain(existing, targetGain, ctx, now);

                const loopSoundId = instance.soundId >= 0 ? instance.soundId : undefined;
                if (loopSoundId !== existing.loopSoundId) {
                    try {
                        existing.loopSource?.stop();
                    } catch {}
                    try {
                        existing.loopSource?.disconnect();
                    } catch {}
                    existing.loopSource = undefined;
                    existing.loopSoundId = undefined;

                    if (loopSoundId !== undefined) {
                        const decodedLoop = this.decode(loopSoundId, undefined, true); // Force resample to AudioContext rate
                        if (decodedLoop) {
                            const loopBuffer = this.prepareBuffer(decodedLoop, ctx, true);
                            const loopSource = ctx.createBufferSource();
                            loopSource.buffer = loopBuffer;
                            loopSource.loop = true;
                            loopSource.loopStart = 0;
                            loopSource.loopEnd = loopBuffer.duration;
                            loopSource.connect(existing.gainNode);
                            this.registerSource(loopSource);
                            loopSource.start(now);
                            existing.loopSource = loopSource;
                            existing.loopSoundId = loopSoundId;
                        } else {
                            console.warn(
                                `[SoundEffectSystem] Failed to decode ambient loop ${loopSoundId} for loc ${instance.locId}`,
                            );
                        }
                    }
                }

                const hasAlternates =
                    instance.soundIds !== undefined &&
                    instance.soundIds.length > 0 &&
                    instance.soundIds.some((id) => id !== undefined && id >= 0);

                if (!hasAlternates) {
                    existing.nextChangeTime = Infinity;
                    if (existing.overlaySource) {
                        try {
                            existing.overlaySource.stop();
                        } catch {}
                        try {
                            existing.overlaySource.disconnect();
                        } catch {}
                        existing.overlaySource = undefined;
                    }
                } else if (existing.nextChangeTime === Infinity) {
                    existing.nextChangeTime = this.computeNextChangeTime(instance, now);
                }

                existing.instance = instance;

                // Check if we need to change/replay sound
                if (now >= existing.nextChangeTime && existing.nextChangeTime !== Infinity) {
                    this.playOverlaySound(key, existing, instance, ctx, now);
                }
            } else {
                // Start new ambient sound
                this.startAmbientSound(key, instance, ctx, volume, now);
            }
        }

        // Stop sounds that are no longer in range
        for (const [key, active] of this.ambientSounds.entries()) {
            if (!activeKeys.has(key)) {
                this.beginAmbientFadeOut(key, active, ctx, now);
            }
            if (
                active.fadeOutActive &&
                active.stopAt !== undefined &&
                ctx.currentTime >= active.stopAt
            ) {
                this.stopAmbientSound(key, ctx);
            }
        }
    }

    private ambientKey(instance: AmbientSoundInstance): string {
        const quant = (value: number | undefined): number => {
            if (value === undefined || Number.isNaN(value)) return 0;
            return Math.round(value);
        };
        return `${instance.locId}_${quant(instance.x)}_${quant(instance.y)}_${quant(instance.z)}`;
    }

    private computeNextChangeTime(instance: AmbientSoundInstance, now: number): number {
        if (instance.deferSwap) {
            return Infinity;
        }

        const minTicks = Math.max(
            typeof instance.changeTicksMin === "number" ? instance.changeTicksMin : 0,
            0,
        );
        const maxTicks = Math.max(
            typeof instance.changeTicksMax === "number" ? instance.changeTicksMax : 0,
            minTicks,
        );

        if (minTicks === 0 && maxTicks === 0) {
            return Infinity;
        }

        // changeTicks applies to both single sounds (for replay delay) and multi-sounds (for swap delay)
        const range = maxTicks - minTicks;
        const ticks = minTicks + (range > 0 ? Math.random() * range : 0);
        return now + ticks * TICK_LENGTH_SECONDS;
    }

    private computeDistanceGain(dist: number, maxDist: number, curve: number): number {
        if (maxDist <= 0) {
            return 1;
        }
        const clamped = Math.min(Math.max(dist / maxDist, 0), 1);
        switch (curve) {
            case DistanceFadeCurve.QUADRATIC:
                return 1 - clamped * clamped;
            case DistanceFadeCurve.CUBIC:
                return 1 - clamped * clamped * clamped;
            case DistanceFadeCurve.EXPONENTIAL:
                return Math.pow(1 - clamped, 2);
            case DistanceFadeCurve.LINEAR:
            default:
                return 1 - clamped;
        }
    }

    private scheduleGainRamp(
        gain: AudioParam,
        startTime: number,
        from: number,
        to: number,
        duration: number,
        curveId?: number,
    ): void {
        const fn = this.getFadeCurve(curveId);
        const steps = Math.max(2, Math.ceil(duration / 0.05));
        gain.setValueAtTime(from, startTime);
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const shaped = fn(progress);
            const value = from + (to - from) * shaped;
            gain.linearRampToValueAtTime(value, startTime + progress * duration);
        }
    }

    private getFadeCurve(curveId?: number): (t: number) => number {
        switch (curveId) {
            case 1:
                return (t) => 1 - Math.pow(1 - t, 3); // ease-out cubic
            case 2:
                return (t) => t * t; // ease-in quadratic
            case 3:
                return (t) => t * t * (3 - 2 * t); // smoothstep
            default:
                return (t) => t; // linear
        }
    }

    private adjustAmbientGain(
        active: ActiveAmbientSound,
        targetGain: number,
        ctx: AudioContext,
        now: number,
    ): void {
        const ramp = active.fadeInDurationSec > 0 ? active.fadeInDurationSec : 0.05;
        const gain = active.gainNode.gain;
        gain.cancelScheduledValues(now);
        const current = gain.value;
        gain.setValueAtTime(current, now);
        if (ramp > 0) {
            this.scheduleGainRamp(
                gain,
                now,
                current,
                targetGain,
                ramp,
                active.instance.fadeInCurve,
            );
        } else {
            gain.setValueAtTime(targetGain, now);
        }
    }

    private beginAmbientFadeOut(
        key: string,
        active: ActiveAmbientSound,
        ctx: AudioContext,
        now: number,
    ): void {
        if (active.fadeOutActive) {
            return;
        }
        const duration = active.fadeOutDurationSec > 0 ? active.fadeOutDurationSec : 0.1;
        const gain = active.gainNode.gain;
        gain.cancelScheduledValues(now);
        const current = gain.value;
        gain.setValueAtTime(current, now);
        if (duration > 0) {
            this.scheduleGainRamp(gain, now, current, 0, duration, active.instance.fadeOutCurve);
        } else {
            gain.setValueAtTime(0, now);
        }
        active.fadeOutActive = true;
        active.stopAt = now + duration + active.retainDurationSec;
    }

    private startAmbientSound(
        key: string,
        instance: AmbientSoundInstance,
        ctx: AudioContext,
        volume: number,
        now: number,
    ): void {
        const gainNode = ctx.createGain();
        // Connect ambient sounds through the ambient gain node (separate from SFX)
        if (!this.ambientGainNode) {
            this.ambientGainNode = ctx.createGain();
            this.ambientGainNode.gain.value = this.ambientVolume;
            this.ambientGainNode.connect(ctx.destination);
        }
        gainNode.connect(this.ambientGainNode);

        const loopSoundId = instance.soundId >= 0 ? instance.soundId : undefined;
        let loopSource: AudioBufferSourceNode | undefined;
        if (loopSoundId !== undefined) {
            const decodedLoop = this.decode(loopSoundId, undefined, true); // Force resample to AudioContext rate
            if (!decodedLoop) {
                console.warn(
                    `[SoundEffectSystem] Failed to decode ambient loop ${loopSoundId} for loc ${instance.locId}`,
                );
            } else {
                const loopBuffer = this.prepareBuffer(decodedLoop, ctx, true);
                loopSource = ctx.createBufferSource();
                loopSource.buffer = loopBuffer;
                loopSource.loop = true;
                loopSource.loopStart = 0;
                loopSource.loopEnd = loopBuffer.duration;
                loopSource.connect(gainNode);
                this.registerSource(loopSource);
                loopSource.start(now);
            }
        }

        const fadeInSec = Math.max(
            0,
            (typeof instance.fadeInDurationMs === "number" ? instance.fadeInDurationMs : 0) / 1000,
        );
        const fadeOutSec = Math.max(
            0,
            (typeof instance.fadeOutDurationMs === "number" ? instance.fadeOutDurationMs : 0) /
                1000,
        );
        const retainSec = Math.max(
            0,
            (typeof instance.retainTicks === "number" ? instance.retainTicks : 0) *
                TICK_LENGTH_SECONDS,
        );

        // Scale volume based on number of active sounds to prevent clipping
        // Note: ambient sounds go through ambientGainNode which applies the user's area sound volume
        const activeSoundCount = this.ambientSounds.size + 1; // +1 for the one we're about to add
        const volumeScale = activeSoundCount > 1 ? 1 / Math.sqrt(activeSoundCount) : 1;
        const targetGain = volume * volumeScale;

        gainNode.gain.cancelScheduledValues(now);
        if (fadeInSec > 0) {
            gainNode.gain.setValueAtTime(0, now);
            this.scheduleGainRamp(
                gainNode.gain,
                now,
                0,
                targetGain,
                fadeInSec,
                instance.fadeInCurve,
            );
        } else {
            gainNode.gain.setValueAtTime(targetGain, now);
        }

        const hasAlternates = !!(
            instance.soundIds &&
            instance.soundIds.length > 0 &&
            instance.soundIds.some((id) => id !== undefined && id >= 0)
        );
        const nextChangeTime = hasAlternates ? this.computeNextChangeTime(instance, now) : Infinity;

        this.ambientSounds.set(key, {
            instance,
            gainNode,
            loopSource,
            loopSoundId: loopSource ? loopSoundId : undefined,
            overlaySource: undefined,
            nextChangeTime,
            currentSoundIndex: hasAlternates ? -1 : 0,
            fadeInDurationSec: fadeInSec,
            fadeOutDurationSec: fadeOutSec,
            retainDurationSec: retainSec,
            fadeOutActive: false,
        });
    }

    private playOverlaySound(
        key: string,
        active: ActiveAmbientSound,
        instance: AmbientSoundInstance,
        ctx: AudioContext,
        now: number,
    ): void {
        if (!instance.soundIds || instance.soundIds.length === 0) {
            active.nextChangeTime = Infinity;
            return;
        }

        // Filter out undefined/invalid sound IDs
        const validSoundIds = instance.soundIds.filter((id) => id !== undefined && id >= 0);
        if (validSoundIds.length === 0) {
            active.nextChangeTime = Infinity;
            return;
        }

        if (active.overlaySource) {
            try {
                active.overlaySource.stop();
            } catch {}
            active.overlaySource.disconnect();
            active.overlaySource = undefined;
        }

        // Determine which sound to play next
        let nextSoundId: number;
        let nextIndex: number;

        if (validSoundIds.length > 0) {
            // Multi-sound ambient: pick next sound from array
            if (instance.loopSequentially) {
                nextIndex = (active.currentSoundIndex + 1) % validSoundIds.length;
            } else {
                const count = validSoundIds.length;
                if (count === 1) {
                    nextIndex = 0;
                } else {
                    let candidate = active.currentSoundIndex;
                    while (candidate === active.currentSoundIndex) {
                        candidate = Math.floor(Math.random() * count);
                    }
                    nextIndex = candidate;
                }
            }
            nextSoundId = validSoundIds[nextIndex];
        } else {
            // Single sound ambient: replay the same sound
            nextSoundId = instance.soundId;
            nextIndex = Math.max(active.currentSoundIndex, 0);
        }

        const decoded = this.decode(nextSoundId);
        if (!decoded) {
            return;
        }

        const buffer = this.prepareBuffer(decoded, ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        source.loop = false;
        const overlayGain = ctx.createGain();
        overlayGain.gain.setValueAtTime(0, now);
        const fadeIn = Math.min(0.05, Math.max(0.005, buffer.duration * 0.1));
        const fadeOut = Math.min(0.05, Math.max(0.005, buffer.duration * 0.1));
        const sustainEnd = Math.max(now + fadeIn, now + buffer.duration - fadeOut);
        overlayGain.gain.linearRampToValueAtTime(1, now + fadeIn);
        overlayGain.gain.setValueAtTime(1, sustainEnd);
        overlayGain.gain.linearRampToValueAtTime(0, now + buffer.duration);

        source.connect(overlayGain);
        overlayGain.connect(active.gainNode);
        source.addEventListener("ended", () => {
            try {
                source.disconnect();
                overlayGain.disconnect();
            } catch {}
            if (active.overlaySource === source) {
                active.overlaySource = undefined;
            }
        });
        this.registerSource(source, [overlayGain]);
        source.start(now);

        active.overlaySource = source;
        active.currentSoundIndex = nextIndex;
        active.nextChangeTime = this.computeNextChangeTime(instance, now);
        active.fadeOutActive = false;
        active.stopAt = undefined;
        active.instance = instance;
    }

    private stopAmbientSound(key: string, ctx?: AudioContext): void {
        const active = this.ambientSounds.get(key);
        if (!active) return;

        try {
            active.loopSource?.stop();
        } catch {}
        try {
            active.overlaySource?.stop();
        } catch {}
        try {
            active.loopSource?.disconnect();
        } catch {}
        try {
            active.overlaySource?.disconnect();
        } catch {}
        try {
            active.gainNode.disconnect();
        } catch {}
        this.disconnectNodes([active.gainNode]);

        this.ambientSounds.delete(key);
    }

    stopAllAmbientSounds(): void {
        const ctx = this.context;
        for (const key of this.ambientSounds.keys()) {
            this.stopAmbientSound(key, ctx);
        }
    }

    dispose(): void {
        // Stop all active sources
        for (const source of this.activeSources) {
            try {
                source.stop();
                source.disconnect();
            } catch {}
        }
        this.activeSources.length = 0;

        // Stop all ambient sounds
        this.stopAllAmbientSounds();

        // Remove event listeners
        this.removeContextListeners();

        // Disconnect and close audio context
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = undefined;
        }
        if (this.ambientGainNode) {
            this.ambientGainNode.disconnect();
            this.ambientGainNode = undefined;
        }
        if (this.context) {
            this.context.close().catch(() => {});
            this.context = undefined;
        }

        // Clear caches
        this.decodedCache.clear();
        this.lastPlayed.clear();
        this.warnedSounds.clear();
    }
}
