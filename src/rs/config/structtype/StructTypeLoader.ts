import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, IndexTypeLoader, TypeLoader } from "../TypeLoader";
import { StructType } from "./StructType";

export type StructTypeLoader = TypeLoader<StructType>;

export class ArchiveStructTypeLoader
    extends ArchiveTypeLoader<StructType>
    implements StructTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(StructType, cacheInfo, archive);
    }
}

export class IndexStructTypeLoader extends IndexTypeLoader<StructType> implements StructTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex, fileIdBits: number = 8) {
        super(StructType, cacheInfo, index, fileIdBits);
    }
}
