/**
 * WASM-accelerated Vorbis decoder for standard Ogg Vorbis files and OSRS custom format.
 * Uses @wasm-audio-decoders/ogg-vorbis for standard Ogg files.
 * Uses ported OSRS Vorbis decoder for OSRS custom music sample format.
 */
import { OggVorbisDecoder } from "@wasm-audio-decoders/ogg-vorbis";

import {
    type RawSoundData as OsrsRawSoundData,
    VorbisSample,
    initVorbisSetup,
    isSetupInitialized,
} from "../../rs/audio/vorbis";
import { CacheSystem } from "../../rs/cache/CacheSystem";
import { IndexType } from "../../rs/cache/IndexType";

let decoder: OggVorbisDecoder | null = null;
let initPromise: Promise<OggVorbisDecoder> | null = null;

// Cache for OSRS setup data
let osrsSetupData: Uint8Array | null = null;

/**
 * Initialize the WASM decoder (lazy, singleton).
 */
async function getDecoder(): Promise<OggVorbisDecoder> {
    if (decoder) return decoder;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const dec = new OggVorbisDecoder();
        await dec.ready;
        decoder = dec;
        return dec;
    })();

    return initPromise;
}

export interface DecodedAudio {
    channelData: Float32Array[];
    sampleRate: number;
    samplesDecoded: number;
}

export interface RawSoundData {
    sampleRate: number;
    samples: Int8Array;
    start: number;
    end: number;
    looped: boolean;
}

/**
 * Decode an Ogg Vorbis file to PCM using WASM.
 * @param oggData - Raw Ogg Vorbis file bytes
 * @returns Decoded audio data with channel arrays
 */
export async function decodeOggVorbis(oggData: Uint8Array): Promise<DecodedAudio> {
    const dec = await getDecoder();

    // Use decodeFile for complete files (handles reset internally)
    const result = await dec.decodeFile(oggData);

    return {
        channelData: result.channelData,
        sampleRate: result.sampleRate,
        samplesDecoded: result.samplesDecoded,
    };
}

/**
 * Decode Ogg Vorbis to an AudioBuffer for Web Audio API.
 * @param oggData - Raw Ogg Vorbis file bytes
 * @param context - AudioContext to create buffer in
 * @returns AudioBuffer ready for playback
 */
export async function decodeOggVorbisToAudioBuffer(
    oggData: Uint8Array,
    context: AudioContext,
): Promise<AudioBuffer> {
    const decoded = await decodeOggVorbis(oggData);

    const buffer = context.createBuffer(
        decoded.channelData.length,
        decoded.samplesDecoded,
        decoded.sampleRate,
    );

    for (let ch = 0; ch < decoded.channelData.length; ch++) {
        buffer.copyToChannel(new Float32Array(decoded.channelData[ch]), ch);
    }

    return buffer;
}

/**
 * Check if data is an Ogg Vorbis file (has "OggS" magic).
 */
export function isOggVorbis(data: Uint8Array | Int8Array): boolean {
    return (
        data.length > 4 &&
        data[0] === 0x4f && // O
        data[1] === 0x67 && // g
        data[2] === 0x67 && // g
        data[3] === 0x53 // S
    );
}

/**
 * Free decoder resources (call on app shutdown if needed).
 */
export async function freeDecoder(): Promise<void> {
    if (decoder) {
        await decoder.free();
        decoder = null;
        initPromise = null;
    }
}

/**
 * Load and initialize OSRS Vorbis setup data from cache (group 0, file 0 of musicSamples).
 */
function ensureOsrsSetupInitialized(cache: CacheSystem): boolean {
    if (isSetupInitialized()) return true;

    const index = cache.getIndex(IndexType.DAT2.musicSamples);
    if (!index) return false;

    const file = index.getFile(0, 0);
    if (!file) return false;

    const setupData = new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength);
    initVorbisSetup(setupData);
    return true;
}

/**
 * Load and decode an OSRS Vorbis sample from cache using the ported OSRS decoder.
 *
 * The OSRS music sample format is a custom Vorbis variant that is NOT compatible
 * with standard Ogg Vorbis. This function uses the ported OSRS decoder.
 *
 * @param cache - The cache system
 * @param groupId - Group ID in musicSamples index
 * @param fileId - File ID within the group
 * @returns Decoded sample data or null if not found
 */
export async function loadVorbisSample(
    cache: CacheSystem,
    groupId: number,
    fileId: number,
): Promise<RawSoundData | null> {
    // Group 0, file 0 is the setup data (shared codebooks), not a sample
    if (groupId === 0 && fileId === 0) {
        return null;
    }

    // Initialize OSRS Vorbis setup (shared codebooks, etc.)
    if (!ensureOsrsSetupInitialized(cache)) {
        console.warn("[VorbisWasm] Failed to initialize OSRS Vorbis setup data");
        return null;
    }

    // Load sample file
    const index = cache.getIndex(IndexType.DAT2.musicSamples);
    if (!index) return null;

    const file = index.getFile(groupId, fileId);
    if (!file) return null;

    const sampleData = new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength);

    try {
        // Decode using ported OSRS decoder
        const sample = new VorbisSample(sampleData);
        const raw = sample.toRawSound();

        return {
            sampleRate: raw.sampleRate,
            samples: raw.samples,
            start: raw.start,
            end: raw.end,
            looped: raw.looped,
        };
    } catch (e) {
        console.error(`[VorbisWasm] Failed to decode OSRS sample ${groupId}:${fileId}`, e);
        return null;
    }
}
