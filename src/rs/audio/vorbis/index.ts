/**
 * OSRS Vorbis Decoder Module
 *
 * This is a port of the OSRS custom Vorbis decoder.
 * OSRS uses a modified Vorbis format that is NOT compatible with standard Ogg Vorbis.
 */
export { VorbisBitReader, sharedBitReader } from "./VorbisBitReader";
export { VorbisCodebook } from "./VorbisCodebook";
export { VorbisFloor, type VorbisFloorState } from "./VorbisFloor";
export { VorbisResidue } from "./VorbisResidue";
export { VorbisMapping } from "./VorbisMapping";
export {
    VorbisSample,
    initVorbisSetup,
    isSetupInitialized,
    resetSetup,
    type RawSoundData,
} from "./VorbisSample";
export { iLog, bitReverse, float32Unpack } from "./VorbisUtils";
