import type { CacheInfo } from "../../rs/cache/CacheInfo";
import { ObjType } from "../../rs/config/objtype/ObjType";
import type { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";
import { CustomItemRegistry } from "./CustomItemRegistry";
import type { CustomObjTypeProps } from "./CustomItemTypes";

/**
 * Wrapping ObjTypeLoader that injects custom items.
 *
 * Priority:
 * 1. Custom items (for IDs registered in CustomItemRegistry)
 * 2. Base loader (original cache items)
 *
 * Custom items can use `baseItemId` to copy all properties from
 * an existing cache item before applying customizations.
 */
export class CustomObjTypeLoader implements ObjTypeLoader {
    private readonly customCache = new Map<number, ObjType>();

    constructor(
        private readonly base: ObjTypeLoader,
        private readonly cacheInfo: CacheInfo,
    ) {}

    load(id: number): ObjType {
        // Check custom cache first
        const cached = this.customCache.get(id);
        if (cached) return cached;

        // Check for custom item
        const customItem = CustomItemRegistry.get(id);
        if (customItem) {
            const objType = this.createCustomObjType(
                id,
                customItem.definition.objType,
                customItem.definition.baseItemId,
            );
            this.customCache.set(id, objType);
            return objType;
        }

        // Fall back to base loader
        return this.base.load(id);
    }

    private createCustomObjType(
        id: number,
        props: CustomObjTypeProps,
        baseItemId?: number,
    ): ObjType {
        let objType: ObjType;

        if (baseItemId !== undefined) {
            // Clone from base item
            const base = this.base.load(baseItemId);
            objType = this.cloneObjType(id, base);
        } else {
            // Create new ObjType with defaults
            objType = new ObjType(id, this.cacheInfo);
        }

        // Apply custom properties
        this.applyCustomProps(objType, props);

        return objType;
    }

    private cloneObjType(newId: number, source: ObjType): ObjType {
        const clone = new ObjType(newId, this.cacheInfo);

        // Copy all properties from source
        clone.name = source.name;
        clone.examine = source.examine;
        clone.model = source.model;
        clone.zoom2d = source.zoom2d;
        clone.xan2d = source.xan2d;
        clone.yan2d = source.yan2d;
        clone.zan2d = source.zan2d;
        clone.offsetX2d = source.offsetX2d;
        clone.offsetY2d = source.offsetY2d;
        clone.stackability = source.stackability;
        clone.price = source.price;
        clone.op13 = source.op13;
        clone.op14 = source.op14;
        clone.isMembers = source.isMembers;
        clone.groundActions = [...source.groundActions];
        clone.inventoryActions = [...source.inventoryActions];
        clone.shiftClickIndex = source.shiftClickIndex;
        clone.maleModel = source.maleModel;
        clone.maleModel1 = source.maleModel1;
        clone.maleOffset = source.maleOffset;
        clone.femaleModel = source.femaleModel;
        clone.femaleModel1 = source.femaleModel1;
        clone.femaleOffset = source.femaleOffset;
        clone.maleModel2 = source.maleModel2;
        clone.femaleModel2 = source.femaleModel2;
        clone.maleHeadModel = source.maleHeadModel;
        clone.maleHeadModel2 = source.maleHeadModel2;
        clone.femaleHeadModel = source.femaleHeadModel;
        clone.femaleHeadModel2 = source.femaleHeadModel2;
        clone.op27 = source.op27;
        clone.note = source.note;
        clone.noteTemplate = source.noteTemplate;
        clone.resizeX = source.resizeX;
        clone.resizeY = source.resizeY;
        clone.resizeZ = source.resizeZ;
        clone.ambient = source.ambient;
        clone.contrast = source.contrast;
        clone.team = source.team;
        clone.isTradable = source.isTradable;
        clone.weight = source.weight;
        clone.unnotedId = source.unnotedId;
        clone.notedId = source.notedId;
        clone.placeholder = source.placeholder;
        clone.placeholderTemplate = source.placeholderTemplate;
        clone.manwearXOff = source.manwearXOff;
        clone.manwearYOff = source.manwearYOff;
        clone.manwearZOff = source.manwearZOff;
        clone.womanwearXOff = source.womanwearXOff;
        clone.womanwearYOff = source.womanwearYOff;
        clone.womanwearZOff = source.womanwearZOff;

        // Copy arrays if they exist
        if (source.recolorFrom) clone.recolorFrom = [...source.recolorFrom];
        if (source.recolorTo) clone.recolorTo = [...source.recolorTo];
        if (source.retextureFrom) clone.retextureFrom = [...source.retextureFrom];
        if (source.retextureTo) clone.retextureTo = [...source.retextureTo];
        if (source.countObj) clone.countObj = [...source.countObj];
        if (source.countCo) clone.countCo = [...source.countCo];
        if (source.params) clone.params = new Map(source.params);

        return clone;
    }

    private applyCustomProps(objType: ObjType, props: CustomObjTypeProps): void {
        // Apply each property if defined in the custom props
        if (props.name !== undefined) objType.name = props.name;
        if (props.examine !== undefined) objType.examine = props.examine;
        if (props.model !== undefined) objType.model = props.model;
        if (props.zoom2d !== undefined) objType.zoom2d = props.zoom2d;
        if (props.xan2d !== undefined) objType.xan2d = props.xan2d;
        if (props.yan2d !== undefined) objType.yan2d = props.yan2d;
        if (props.zan2d !== undefined) objType.zan2d = props.zan2d;
        if (props.offsetX2d !== undefined) objType.offsetX2d = props.offsetX2d;
        if (props.offsetY2d !== undefined) objType.offsetY2d = props.offsetY2d;
        if (props.stackability !== undefined) objType.stackability = props.stackability;
        if (props.price !== undefined) objType.price = props.price;
        if (props.isMembers !== undefined) objType.isMembers = props.isMembers;
        if (props.isTradable !== undefined) objType.isTradable = props.isTradable;
        if (props.weight !== undefined) objType.weight = props.weight;
        if (props.team !== undefined) objType.team = props.team;

        // Actions
        if (props.groundActions !== undefined) {
            objType.groundActions = [...props.groundActions];
        }
        if (props.inventoryActions !== undefined) {
            objType.inventoryActions = [...props.inventoryActions];
        }
        if (props.shiftClickIndex !== undefined) {
            objType.shiftClickIndex = props.shiftClickIndex;
        }

        // Equipment models
        if (props.maleModel !== undefined) objType.maleModel = props.maleModel;
        if (props.maleModel1 !== undefined) objType.maleModel1 = props.maleModel1;
        if (props.maleModel2 !== undefined) objType.maleModel2 = props.maleModel2;
        if (props.femaleModel !== undefined) objType.femaleModel = props.femaleModel;
        if (props.femaleModel1 !== undefined) objType.femaleModel1 = props.femaleModel1;
        if (props.femaleModel2 !== undefined) objType.femaleModel2 = props.femaleModel2;
        if (props.maleHeadModel !== undefined) objType.maleHeadModel = props.maleHeadModel;
        if (props.maleHeadModel2 !== undefined) objType.maleHeadModel2 = props.maleHeadModel2;
        if (props.femaleHeadModel !== undefined) objType.femaleHeadModel = props.femaleHeadModel;
        if (props.femaleHeadModel2 !== undefined) objType.femaleHeadModel2 = props.femaleHeadModel2;

        // Wear offsets
        if (props.manwearXOff !== undefined) objType.manwearXOff = props.manwearXOff;
        if (props.manwearYOff !== undefined) objType.manwearYOff = props.manwearYOff;
        if (props.manwearZOff !== undefined) objType.manwearZOff = props.manwearZOff;
        if (props.womanwearXOff !== undefined) objType.womanwearXOff = props.womanwearXOff;
        if (props.womanwearYOff !== undefined) objType.womanwearYOff = props.womanwearYOff;
        if (props.womanwearZOff !== undefined) objType.womanwearZOff = props.womanwearZOff;

        // Scale
        if (props.resizeX !== undefined) objType.resizeX = props.resizeX;
        if (props.resizeY !== undefined) objType.resizeY = props.resizeY;
        if (props.resizeZ !== undefined) objType.resizeZ = props.resizeZ;

        // Lighting
        if (props.ambient !== undefined) objType.ambient = props.ambient;
        if (props.contrast !== undefined) objType.contrast = props.contrast;

        // Recoloring - these fully replace existing colors
        if (props.recolorFrom !== undefined) objType.recolorFrom = [...props.recolorFrom];
        if (props.recolorTo !== undefined) objType.recolorTo = [...props.recolorTo];
        if (props.retextureFrom !== undefined) objType.retextureFrom = [...props.retextureFrom];
        if (props.retextureTo !== undefined) objType.retextureTo = [...props.retextureTo];
    }

    getCount(): number {
        // Include custom items in count
        const baseCount = this.base.getCount();
        const maxCustomId = CustomItemRegistry.getMaxCustomId();
        return Math.max(baseCount, maxCustomId + 1);
    }

    clearCache(): void {
        this.customCache.clear();
        this.base.clearCache();
    }
}
