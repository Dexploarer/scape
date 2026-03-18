import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, IndexTypeLoader, TypeLoader } from "../TypeLoader";
import { EnumType } from "./EnumType";

export type EnumTypeLoader = TypeLoader<EnumType>;

export class ArchiveEnumTypeLoader extends ArchiveTypeLoader<EnumType> implements EnumTypeLoader {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(EnumType, cacheInfo, archive);
    }
}

export class IndexEnumTypeLoader extends IndexTypeLoader<EnumType> implements EnumTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex, fileIdBits: number = 8) {
        super(EnumType, cacheInfo, index, fileIdBits);
    }
}
