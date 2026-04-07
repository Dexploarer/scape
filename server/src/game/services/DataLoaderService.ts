import { ConfigType } from "../../../../src/rs/cache/ConfigType";
import { IndexType } from "../../../../src/rs/cache/IndexType";
import { getCacheLoaderFactory } from "../../../../src/rs/cache/loader/CacheLoaderFactory";
import { Huffman, tryLoadOsrsHuffman } from "../../../../src/rs/chat/Huffman";
import type { BasType } from "../../../../src/rs/config/bastype/BasType";
import type { BasTypeLoader } from "../../../../src/rs/config/bastype/BasTypeLoader";
import { DbRepository } from "../../../../src/rs/config/db/DbRepository";
import type { EnumTypeLoader } from "../../../../src/rs/config/enumtype/EnumTypeLoader";
import { ArchiveHealthBarDefinitionLoader } from "../../../../src/rs/config/healthbar/HealthBarDefinitionLoader";
import type { IdkTypeLoader } from "../../../../src/rs/config/idktype/IdkTypeLoader";
import type { NpcTypeLoader } from "../../../../src/rs/config/npctype/NpcTypeLoader";
import type { ObjType } from "../../../../src/rs/config/objtype/ObjType";
import type { ObjTypeLoader } from "../../../../src/rs/config/objtype/ObjTypeLoader";
import type { SeqTypeLoader } from "../../../../src/rs/config/seqtype/SeqTypeLoader";
import type { LocType } from "../../../../src/rs/config/loctype/LocType";
import type { LocTypeLoader } from "../../../../src/rs/config/loctype/LocTypeLoader";
import type { StructTypeLoader } from "../../../../src/rs/config/structtype/StructTypeLoader";
import type { CacheLoaderFactory } from "../../../../src/rs/cache/loader/CacheLoaderFactory";
import { logger } from "../../utils/logger";
import type { CacheEnv } from "../../world/CacheEnv";

/**
 * Owns all cache-backed type loaders and provides accessor methods.
 * Extracted from WSServer to centralize data loading concerns.
 */
export class DataLoaderService {
    private objTypeLoader?: ObjTypeLoader;
    private idkTypeLoader?: IdkTypeLoader;
    private basTypeLoader?: BasTypeLoader;
    private locTypeLoader?: LocTypeLoader;
    private enumTypeLoader?: EnumTypeLoader;
    private structTypeLoader?: StructTypeLoader;
    private seqTypeLoader?: SeqTypeLoader;
    private npcTypeLoader?: NpcTypeLoader;
    private dbRepository?: DbRepository;
    private huffman?: Huffman;
    private healthBarDefLoader?: ArchiveHealthBarDefinitionLoader;

    private cacheFactory: CacheLoaderFactory;

    constructor(private readonly cacheEnv: CacheEnv) {
        this.cacheFactory = getCacheLoaderFactory(
            cacheEnv.info,
            cacheEnv.cacheSystem,
        );

        this.huffman = tryLoadOsrsHuffman(cacheEnv.cacheSystem);
        if (!this.huffman) {
            logger.warn(
                "[chat] failed to load OSRS Huffman table (idx10); public chat may be garbled",
            );
        }

        try {
            const configIndex = cacheEnv.cacheSystem.getIndex(IndexType.DAT2.configs);
            if (configIndex.archiveExists(ConfigType.OSRS.healthBar)) {
                const archive = configIndex.getArchive(ConfigType.OSRS.healthBar);
                this.healthBarDefLoader = new ArchiveHealthBarDefinitionLoader(
                    cacheEnv.info,
                    archive,
                );
            }
        } catch (err) { logger.warn("[data-loader] failed to init healthbar loader", err); }

        this.initLoaders();
    }

    private initLoaders(): void {
        const factory = this.cacheFactory;
        if (!factory) return;

        try {
            this.locTypeLoader = factory.getLocTypeLoader();
        } catch (err) { logger.warn("[data-loader] failed to init locTypeLoader", err); }
        try {
            this.npcTypeLoader = factory.getNpcTypeLoader?.();
        } catch (err) { logger.warn("[data-loader] failed to init npcTypeLoader", err); }
        try {
            this.seqTypeLoader = factory.getSeqTypeLoader?.();
        } catch (err) { logger.warn("[data-loader] failed to init seqTypeLoader", err); }
        try {
            this.objTypeLoader = factory.getObjTypeLoader();
        } catch (err) { logger.warn("[data-loader] failed to init objTypeLoader", err); }
        try {
            this.idkTypeLoader = factory.getIdkTypeLoader();
        } catch (err) { logger.warn("[data-loader] failed to init idkTypeLoader", err); }
        try {
            this.basTypeLoader = factory.getBasTypeLoader();
        } catch (err) { logger.warn("[data-loader] failed to init basTypeLoader", err); }
        try {
            this.enumTypeLoader = factory.getEnumTypeLoader?.();
        } catch (err) { logger.warn("[data-loader] failed to init enumTypeLoader", err); }
        try {
            this.structTypeLoader = factory.getStructTypeLoader?.();
        } catch (err) { logger.warn("[data-loader] failed to init structTypeLoader", err); }

        if (this.cacheEnv) {
            try {
                this.dbRepository = new DbRepository(this.cacheEnv.cacheSystem);
            } catch (err) {
                logger.warn("[DataLoaderService] failed to load DbRepository", err);
            }
        }
    }

    getCacheEnv(): CacheEnv {
        return this.cacheEnv;
    }

    getCacheFactory(): CacheLoaderFactory {
        return this.cacheFactory;
    }

    getObjType(itemId: number): ObjType | undefined {
        try {
            return this.objTypeLoader?.load?.(itemId);
        } catch {
            return undefined;
        }
    }

    getObjTypeLoader(): ObjTypeLoader | undefined {
        return this.objTypeLoader;
    }

    getIdkTypeLoader(): IdkTypeLoader | undefined {
        return this.idkTypeLoader;
    }

    getBasTypeLoader(): BasTypeLoader | undefined {
        return this.basTypeLoader;
    }

    loadBas(basId: number): BasType | undefined {
        try {
            return this.basTypeLoader?.load(basId);
        } catch {
            return undefined;
        }
    }

    getLocTypeLoader(): LocTypeLoader | undefined {
        return this.locTypeLoader;
    }

    getLocDefinition(locId: number): LocType | undefined {
        try {
            return this.locTypeLoader?.load?.(locId);
        } catch {
            return undefined;
        }
    }

    getEnumTypeLoader(): EnumTypeLoader | undefined {
        return this.enumTypeLoader;
    }

    getStructTypeLoader(): StructTypeLoader | undefined {
        return this.structTypeLoader;
    }

    getSeqTypeLoader(): SeqTypeLoader | undefined {
        return this.seqTypeLoader;
    }

    getNpcTypeLoader(): NpcTypeLoader | undefined {
        return this.npcTypeLoader;
    }

    getDbRepository(): DbRepository | undefined {
        return this.dbRepository;
    }

    getHuffman(): Huffman | undefined {
        return this.huffman;
    }

    getHealthBarDefLoader(): ArchiveHealthBarDefinitionLoader | undefined {
        return this.healthBarDefLoader;
    }
}
