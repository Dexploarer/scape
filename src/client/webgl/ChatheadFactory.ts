import { Model } from "../../rs/model/Model";
import { ModelData } from "../../rs/model/ModelData";
import type { ModelLoader } from "../../rs/model/ModelLoader";
import type { TextureLoader } from "../../rs/texture/TextureLoader";

/**
 * Builds lit, scaled NPC chathead models with recolor/retexture applied.
 * Caches by npcType.id to avoid repeat work.
 */
export class ChatheadFactory {
    private cache = new Map<number, Model>();

    constructor(
        private readonly modelLoader: ModelLoader,
        private readonly textureLoader: TextureLoader,
    ) {}

    get(npcType: any): Model | undefined {
        if (!npcType || !Array.isArray(npcType.chatheadModelIds)) return undefined;
        const key = npcType.id | 0;
        const cached = this.cache.get(key);
        if (cached) return cached;

        const parts: ModelData[] = [];
        for (const mid of npcType.chatheadModelIds) {
            const md = this.modelLoader.getModel(mid);
            if (!md) return undefined;
            parts.push(md);
        }
        if (!parts.length) return undefined;

        const merged = ModelData.merge(parts, parts.length);

        try {
            if (npcType.recolorFrom && npcType.recolorTo) {
                for (let i = 0; i < npcType.recolorFrom.length; i++) {
                    merged.recolor(npcType.recolorFrom[i], npcType.recolorTo[i]);
                }
            }
            if (npcType.retextureFrom && npcType.retextureTo) {
                for (let i = 0; i < npcType.retextureFrom.length; i++) {
                    merged.retexture(npcType.retextureFrom[i], npcType.retextureTo[i]);
                }
            }
        } catch {}

        let model = merged.light(
            this.textureLoader,
            (npcType.ambient | 0) + 64,
            (npcType.contrast | 0) * 5 + 850,
            -30,
            -50,
            -30,
        );

        try {
            const hasScale = (npcType.widthScale | 0) !== 128 || (npcType.heightScale | 0) !== 128;
            if (hasScale) {
                model = Model.copyAnimated(model, true, true);
                model.scale(
                    npcType.widthScale | 0,
                    npcType.heightScale | 0,
                    npcType.widthScale | 0,
                );
            }
        } catch {}

        this.cache.set(key, model);
        return model;
    }

    clear(): void {
        this.cache.clear();
    }
}
