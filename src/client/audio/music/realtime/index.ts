/**
 * Real-time OSRS music synthesis system.
 *
 * This module provides faithful reproduction of OSRS music using:
 * - AudioWorklet for real-time PCM generation
 * - MusicPatch data for per-note synthesis parameters
 * - Full 16-channel MIDI state machine
 * - Accurate tempo tracking with tempo map
 * - Vorbis sample decoding from the cache
 */

export { RealtimeMidiSynth } from "./RealtimeMidiSynth";
export { MusicPatchNode } from "./MusicPatchNode";
export type { SampleData, PatchNoteData } from "./MusicPatchNode";
export type { WorkletMessage } from "./MusicWorkletProcessor";
