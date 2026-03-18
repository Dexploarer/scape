import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, TypeLoader } from "../TypeLoader";
import { HitSplatType } from "./HitSplatType";

export type HitSplatTypeLoader = TypeLoader<HitSplatType>;

export class ArchiveHitSplatTypeLoader
    extends ArchiveTypeLoader<HitSplatType>
    implements HitSplatTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(HitSplatType, cacheInfo, archive);
    }
}
