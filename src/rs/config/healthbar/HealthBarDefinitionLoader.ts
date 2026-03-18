import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, TypeLoader } from "../TypeLoader";
import { HealthBarDefinition } from "./HealthBarDefinition";

export type HealthBarDefinitionLoader = TypeLoader<HealthBarDefinition>;

export class ArchiveHealthBarDefinitionLoader
    extends ArchiveTypeLoader<HealthBarDefinition>
    implements HealthBarDefinitionLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(HealthBarDefinition, cacheInfo, archive);
    }
}
