import { CacheIndex } from "../cache/CacheIndex";
import { CacheInfo } from "../cache/CacheInfo";
import { CacheSystem } from "../cache/CacheSystem";
import { detectCacheType } from "../cache/CacheType";
import { IndexType } from "../cache/IndexType";
import { RawSoundData, SoundEffect } from "./legacy/SoundEffect";

export class SoundEffectLoader {
    private readonly index?: CacheIndex;

    constructor(cacheInfo: CacheInfo, cacheSystem: CacheSystem) {
        const type = detectCacheType(cacheInfo);

        let indexId: number | undefined;
        if (type === "dat") {
            if (cacheSystem.indexExists(IndexType.DAT.sounds)) {
                indexId = IndexType.DAT.sounds;
            }
        } else if (type === "dat2") {
            const soundEffectsIdx = IndexType.DAT2.soundEffects;

            if (cacheSystem.indexExists(soundEffectsIdx)) {
                indexId = soundEffectsIdx;
            } else if (cacheSystem.indexExists(4)) {
                // Try index 4 directly
                indexId = 4;
            }
        }
        if (indexId !== undefined) {
            this.index = cacheSystem.getIndex(indexId);
        }
    }

    available(): boolean {
        return !!this.index;
    }

    private tryDecode(id: number): RawSoundData | undefined {
        if (!this.index) return undefined;
        const file = this.index.getFileSmart(id);
        if (!file) return undefined;
        const buffer = file.getDataAsBuffer();
        const effect = SoundEffect.decode(buffer);
        effect.calculateDelay();
        const raw = effect.toRawSound();
        if (!raw || !raw.samples || raw.samples.length <= 0) return undefined;
        return raw;
    }

    load(soundId: number): RawSoundData | undefined {
        if (!this.index) return undefined;
        try {
            return this.tryDecode(soundId);
        } catch (err) {
            console.log("[SoundEffectLoader] failed to load sound", soundId, err);
            return undefined;
        }
    }
}
