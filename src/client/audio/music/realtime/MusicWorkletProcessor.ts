/**
 * AudioWorklet processor for real-time OSRS music synthesis.
 *
 * NOTE: The actual worklet code is inlined in RealtimeMidiSynth.ts as a string
 * because AudioWorklets must be loaded as separate modules from a Blob URL.
 * This file contains type definitions for worklet messages.
 */

// Types for worklet communication
export interface NoteOnMessage {
    type: "noteOn";
    noteId: number;
    channel: number;
    key: number;
    velocity: number;
    sampleIndex: number;
    basePitch: number;
    patchVolume: number;
    pan: number;
    exclusiveClass: number;
    looped: boolean;
    loopStart: number;
    loopEnd: number;
    sampleRate: number;
    volumeEnvelope: number[] | null;
    releaseEnvelope: number[] | null;
    decayRate: number;
    volumeEnvRate: number;
    releaseEnvRate: number;
    decayModifier: number;
    vibratoDepth: number;
    vibratoRate: number;
    vibratoDelay: number;
}

export interface NoteOffMessage {
    type: "noteOff";
    channel: number;
    key: number;
}

export interface ControlChangeMessage {
    type: "controlChange";
    channel: number;
    controller: number;
    value: number;
}

export interface PitchBendMessage {
    type: "pitchBend";
    channel: number;
    value: number;
}

export interface ProgramChangeMessage {
    type: "programChange";
    channel: number;
    program: number;
}

export interface SetVolumeMessage {
    type: "setVolume";
    volume: number;
}

export interface StopAllMessage {
    type: "stopAll";
}

export interface LoadSampleMessage {
    type: "loadSample";
    index: number;
    samples: Float32Array;
    sampleRate: number;
    looped: boolean;
    loopStart: number;
    loopEnd: number;
}

export type WorkletMessage =
    | NoteOnMessage
    | NoteOffMessage
    | ControlChangeMessage
    | PitchBendMessage
    | ProgramChangeMessage
    | SetVolumeMessage
    | StopAllMessage
    | LoadSampleMessage;
