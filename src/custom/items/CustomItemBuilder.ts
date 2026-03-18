import type {
    EquipmentType,
    ItemBonuses,
    ItemRequirements,
    WeaponInterface,
} from "../../../server/src/data/items";
import { ObjStackability } from "../../rs/config/objtype/ObjStackability";
import type {
    CustomItemDefProps,
    CustomItemDefinition,
    CustomObjTypeProps,
} from "./CustomItemTypes";

/**
 * Fluent builder for creating custom item definitions.
 * Provides a type-safe, ergonomic API for defining custom items.
 *
 * @example
 * ```typescript
 * // Create a new item based on an existing cache item
 * const purpleBond = CustomItemBuilder
 *     .create(50000)
 *     .basedOn(13190)  // Copy from OSRS bond
 *     .name("$5 Bond")
 *     .examine("A special purple bond.")
 *     .recolor([5765], [52497])  // Green → Purple
 *     .inventoryActions("Redeem", null, null, null, "Drop")
 *     .build();
 * ```
 */
export class CustomItemBuilder {
    private _id: number;
    private _baseItemId?: number;
    private _objType: CustomObjTypeProps = { name: "null" };
    private _itemDef: CustomItemDefProps = {};

    constructor(id: number) {
        this._id = id;
    }

    /**
     * Create a new custom item with the given ID.
     * IDs should be 50000+ to avoid conflicts with cache items.
     */
    static create(id: number): CustomItemBuilder {
        return new CustomItemBuilder(id);
    }

    /**
     * Copy all properties from an existing cache item before applying customizations.
     * This is the recommended way to create recolored variants of existing items.
     */
    basedOn(baseItemId: number): this {
        this._baseItemId = baseItemId;
        return this;
    }

    // === Core Properties ===

    name(value: string): this {
        this._objType.name = value;
        return this;
    }

    examine(value: string): this {
        this._objType.examine = value;
        return this;
    }

    // === Model & Rendering ===

    inventoryModel(modelId: number): this {
        this._objType.model = modelId;
        return this;
    }

    inventorySprite(opts: {
        zoom?: number;
        xan?: number;
        yan?: number;
        zan?: number;
        offsetX?: number;
        offsetY?: number;
    }): this {
        if (opts.zoom !== undefined) this._objType.zoom2d = opts.zoom;
        if (opts.xan !== undefined) this._objType.xan2d = opts.xan;
        if (opts.yan !== undefined) this._objType.yan2d = opts.yan;
        if (opts.zan !== undefined) this._objType.zan2d = opts.zan;
        if (opts.offsetX !== undefined) this._objType.offsetX2d = opts.offsetX;
        if (opts.offsetY !== undefined) this._objType.offsetY2d = opts.offsetY;
        return this;
    }

    // === Equipment Models ===

    maleWearModels(primary: number, secondary?: number, tertiary?: number): this {
        this._objType.maleModel = primary;
        if (secondary !== undefined) this._objType.maleModel1 = secondary;
        if (tertiary !== undefined) this._objType.maleModel2 = tertiary;
        return this;
    }

    femaleWearModels(primary: number, secondary?: number, tertiary?: number): this {
        this._objType.femaleModel = primary;
        if (secondary !== undefined) this._objType.femaleModel1 = secondary;
        if (tertiary !== undefined) this._objType.femaleModel2 = tertiary;
        return this;
    }

    headModels(male: number, female: number, male2?: number, female2?: number): this {
        this._objType.maleHeadModel = male;
        this._objType.femaleHeadModel = female;
        if (male2 !== undefined) this._objType.maleHeadModel2 = male2;
        if (female2 !== undefined) this._objType.femaleHeadModel2 = female2;
        return this;
    }

    // === Recoloring ===

    /**
     * Recolor the item model by swapping HSL color values.
     * OSRS uses packed HSL: (hue << 10) | (saturation << 7) | lightness
     *
     * @param from - Original color values to replace
     * @param to - New color values
     */
    recolor(from: number[], to: number[]): this {
        this._objType.recolorFrom = from;
        this._objType.recolorTo = to;
        return this;
    }

    /**
     * Retexture the item model by swapping texture IDs.
     */
    retexture(from: number[], to: number[]): this {
        this._objType.retextureFrom = from;
        this._objType.retextureTo = to;
        return this;
    }

    // === Actions ===

    /**
     * Set ground (right-click on ground item) actions.
     * Pass null for empty slots. Max 5 actions.
     */
    groundActions(...actions: (string | null)[]): this {
        const padded = [...actions];
        while (padded.length < 5) padded.push(null);
        this._objType.groundActions = padded.slice(0, 5);
        return this;
    }

    /**
     * Set inventory (right-click in inventory) actions.
     * Pass null for empty slots. Max 5 actions.
     */
    inventoryActions(...actions: (string | null)[]): this {
        const padded = [...actions];
        while (padded.length < 5) padded.push(null);
        this._objType.inventoryActions = padded.slice(0, 5);
        return this;
    }

    shiftClick(index: number): this {
        this._objType.shiftClickIndex = index;
        return this;
    }

    // === Economy ===

    price(value: number): this {
        this._objType.price = value;
        this._itemDef.value = value;
        return this;
    }

    weight(value: number): this {
        this._objType.weight = value;
        return this;
    }

    tradeable(value: boolean = true): this {
        this._objType.isTradable = value;
        this._itemDef.tradeable = value;
        return this;
    }

    stackable(always: boolean = true): this {
        this._objType.stackability = always ? ObjStackability.ALWAYS : ObjStackability.SOMETIMES;
        this._itemDef.stackable = always;
        return this;
    }

    membersOnly(value: boolean = true): this {
        this._objType.isMembers = value;
        return this;
    }

    // === Equipment ===

    equipmentType(type: EquipmentType): this {
        this._itemDef.equipmentType = type;
        return this;
    }

    weaponInterface(iface: WeaponInterface): this {
        this._itemDef.weaponInterface = iface;
        return this;
    }

    twoHanded(value: boolean = true): this {
        this._itemDef.doubleHanded = value;
        return this;
    }

    // === Combat Stats ===

    bonuses(bonuses: ItemBonuses): this {
        this._itemDef.bonuses = bonuses;
        return this;
    }

    requirements(requirements: ItemRequirements): this {
        this._itemDef.requirements = requirements;
        return this;
    }

    // === Animations ===

    animations(anims: {
        stand?: number;
        walk?: number;
        run?: number;
        block?: number;
        standTurn?: number;
        turn180?: number;
        turn90CW?: number;
        turn90CCW?: number;
    }): this {
        if (anims.stand !== undefined) this._itemDef.standAnim = anims.stand;
        if (anims.walk !== undefined) this._itemDef.walkAnim = anims.walk;
        if (anims.run !== undefined) this._itemDef.runAnim = anims.run;
        if (anims.block !== undefined) this._itemDef.blockAnim = anims.block;
        if (anims.standTurn !== undefined) this._itemDef.standTurnAnim = anims.standTurn;
        if (anims.turn180 !== undefined) this._itemDef.turn180Anim = anims.turn180;
        if (anims.turn90CW !== undefined) this._itemDef.turn90CWAnim = anims.turn90CW;
        if (anims.turn90CCW !== undefined) this._itemDef.turn90CCWAnim = anims.turn90CCW;
        return this;
    }

    // === Build ===

    /**
     * Build the final custom item definition.
     */
    build(): CustomItemDefinition {
        return {
            id: this._id,
            baseItemId: this._baseItemId,
            objType: { ...this._objType },
            itemDef: { ...this._itemDef },
        };
    }
}
