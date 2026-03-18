import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import {
    ArchiveTypeLoader,
    IndexTypeLoader,
    IndexedDatTypeLoader,
    TypeLoader,
} from "../TypeLoader";
import { IdkType } from "./IdkType";

export type IdkTypeLoader = TypeLoader<IdkType>;

export class DatIdkTypeLoader {
    static load(cacheInfo: CacheInfo, configArchive: Archive): IdkTypeLoader {
        // Legacy/DAT caches store identkits in idk.dat (+ idk.idx for indexed variant)
        return IndexedDatTypeLoader.load(IdkType, cacheInfo, configArchive, "idk");
    }
}

export class ArchiveIdkTypeLoader extends ArchiveTypeLoader<IdkType> implements IdkTypeLoader {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(IdkType, cacheInfo, archive);
    }
}

export class IndexIdkTypeLoader extends IndexTypeLoader<IdkType> implements IdkTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex, fileIdBits: number = 7) {
        // Most RS2 config indices use 7–8 file id bits; allow override if needed
        super(IdkType, cacheInfo, index, fileIdBits);
    }
}
