import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, DummyTypeLoader, IndexTypeLoader, TypeLoader } from "../TypeLoader";
import { ParamType } from "./ParamType";

export type ParamTypeLoader = TypeLoader<ParamType>;

export class DummyParamTypeLoader extends DummyTypeLoader<ParamType> {
    constructor(cacheInfo: CacheInfo) {
        super(cacheInfo, ParamType);
    }
}

export class ArchiveParamTypeLoader
    extends ArchiveTypeLoader<ParamType>
    implements ParamTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(ParamType, cacheInfo, archive);
    }
}

export class IndexParamTypeLoader extends IndexTypeLoader<ParamType> implements ParamTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex, fileIdBits: number = 8) {
        super(ParamType, cacheInfo, index, fileIdBits);
    }
}
