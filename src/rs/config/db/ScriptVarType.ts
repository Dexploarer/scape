import type { ByteBuffer } from "../../io/ByteBuffer";

export enum ScriptVarTypeId {
    INTEGER = 0,
    BOOLEAN = 1,
    SEQ = 6,
    COLOUR = 7,
    COMPONENT = 9,
    IDKIT = 10,
    MIDI = 11,
    NAMEDOBJ = 13,
    SYNTH = 14,
    STAT = 17,
    COORDGRID = 22,
    GRAPHIC = 23,
    FONTMETRICS = 25,
    ENUM = 26,
    JINGLE = 28,
    LOC = 30,
    MODEL = 31,
    NPC = 32,
    OBJ = 33,
    STRING = 36,
    SPOTANIM = 37,
    INV = 39,
    TEXTURE = 40,
    CHAR = 42,
    MAPSCENEICON = 55,
    MAPELEMENT = 59,
    HITMARK = 62,
    STRUCT = 73,
    DBROW = 74,
    VARP = 209,
}

export function isStringType(type: ScriptVarTypeId): boolean {
    return type === ScriptVarTypeId.STRING || type === ScriptVarTypeId.CHAR;
}

export function isBooleanType(type: ScriptVarTypeId): boolean {
    return type === ScriptVarTypeId.BOOLEAN;
}

/**
 * Check if a type is a reference type that should default to -1 (null) when not set.
 * This includes DBROW, OBJ, NPC, LOC, COMPONENT, STRUCT, etc.
 */
export function isReferenceType(type: ScriptVarTypeId): boolean {
    switch (type) {
        case ScriptVarTypeId.DBROW:
        case ScriptVarTypeId.OBJ:
        case ScriptVarTypeId.NAMEDOBJ:
        case ScriptVarTypeId.NPC:
        case ScriptVarTypeId.LOC:
        case ScriptVarTypeId.COMPONENT:
        case ScriptVarTypeId.STRUCT:
        case ScriptVarTypeId.ENUM:
        case ScriptVarTypeId.SEQ:
        case ScriptVarTypeId.GRAPHIC:
        case ScriptVarTypeId.SPOTANIM:
        case ScriptVarTypeId.INV:
        case ScriptVarTypeId.MODEL:
        case ScriptVarTypeId.IDKIT:
        case ScriptVarTypeId.TEXTURE:
        case ScriptVarTypeId.MIDI:
        case ScriptVarTypeId.JINGLE:
        case ScriptVarTypeId.SYNTH:
            return true;
        default:
            return false;
    }
}

export function decodeScriptVarValue(type: ScriptVarTypeId, buffer: ByteBuffer): any {
    if (isStringType(type)) {
        return buffer.readString();
    }
    if (isBooleanType(type)) {
        return buffer.readInt() !== 0;
    }
    // For now treat all other types as integer payloads
    return buffer.readInt();
}
