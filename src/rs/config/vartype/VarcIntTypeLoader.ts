import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, DummyTypeLoader, TypeLoader } from "../TypeLoader";
import { VarcIntType } from "./VarcIntType";

export type VarcIntTypeLoader = TypeLoader<VarcIntType>;

export class EmptyVarcIntTypeLoader extends DummyTypeLoader<VarcIntType> {
    constructor(cacheInfo: CacheInfo) {
        super(cacheInfo, VarcIntType);
    }
}

export class ArchiveVarcIntTypeLoader
    extends ArchiveTypeLoader<VarcIntType>
    implements VarcIntTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(VarcIntType, cacheInfo, archive);
    }
}
