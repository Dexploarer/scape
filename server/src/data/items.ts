import fs from "fs";
import path from "path";

import { CustomItemRegistry } from "../../../src/custom/items/CustomItemRegistry";

export type EquipmentType =
    | "NONE"
    | "AMULET"
    | "ARROWS"
    | "BODY"
    | "BOOTS"
    | "CAPE"
    | "COIF"
    | "FULL_HELMET"
    | "GLOVES"
    | "HAT"
    | "HOODED_CAPE"
    | "LEGS"
    | "MASK"
    | "MED_HELMET"
    | "PLATEBODY"
    | "RING"
    | "SHIELD"
    | "WEAPON";

export type WeaponInterface =
    | "ABYSSAL_BLUDGEON"
    | "ABYSSAL_DAGGER"
    | "ANCIENT_STAFF"
    | "BALLISTA"
    | "BATTLEAXE"
    | "BLOWPIPE"
    | "BULWARK"
    | "CLAWS"
    | "CROSSBOW"
    | "DAGGER"
    | "DARK_BOW"
    | "DART"
    | "DRAGON_DAGGER"
    | "ELDER_MAUL"
    | "GHRAZI_RAPIER"
    | "GODSWORD"
    | "GRANITE_MAUL"
    | "GREATAXE"
    | "HALBERD"
    | "JAVELIN"
    | "KARILS_CROSSBOW"
    | "KNIFE"
    | "LONGBOW"
    | "LONGSWORD"
    | "MACE"
    | "MAUL"
    | "OBBY_RINGS"
    | "PICKAXE"
    | "SARADOMIN_SWORD"
    | "SCIMITAR"
    | "SCYTHE"
    | "SHORTBOW"
    | "SPEAR"
    | "STAFF"
    | "SWORD"
    | "THROWNAXE"
    | "TWO_HANDED_SWORD"
    | "UNARMED"
    | "VERACS_FLAIL"
    | "WARHAMMER"
    | "WHIP";

export type ItemBonuses = readonly [
    stabAttack: number,
    slashAttack: number,
    crushAttack: number,
    magicAttack: number,
    rangedAttack: number,
    stabDefence: number,
    slashDefence: number,
    crushDefence: number,
    magicDefence: number,
    rangedDefence: number,
    meleeStrength: number,
    rangedStrength: number,
    magicDamage: number,
    prayer: number,
];

export type ItemRequirements = readonly [
    attack: number,
    defence: number,
    strength: number,
    hitpoints: number,
    ranged: number,
    prayer: number,
    magic: number,
    cooking: number,
    woodcutting: number,
    fletching: number,
    fishing: number,
    firemaking: number,
    crafting: number,
    smithing: number,
    mining: number,
    herblore: number,
    agility: number,
    thieving: number,
    slayer: number,
    farming: number,
    runecraft: number,
    hunter: number,
    construction: number,
];

export interface ItemDefinition {
    id: number;
    name: string;
    examine: string;
    equipmentType?: EquipmentType;
    weaponInterface?: WeaponInterface;
    doubleHanded: boolean;
    stackable: boolean;
    tradeable: boolean;
    dropable: boolean;
    sellable: boolean;
    noted: boolean;
    value: number;
    bloodMoneyValue?: number;
    highAlch: number;
    lowAlch: number;
    dropValue: number;
    noteId: number;
    blockAnim: number;
    standAnim: number;
    walkAnim: number;
    runAnim: number;
    standTurnAnim: number;
    turn180Anim: number;
    turn90CWAnim: number;
    turn90CCWAnim: number;
    weight: number;
    bonuses?: ItemBonuses;
    requirements?: ItemRequirements;
}

type RawItem = Omit<ItemDefinition, "bonuses" | "requirements"> & {
    bonuses?: number[];
    requirements?: number[];
};

const ITEMS_PATH = path.resolve(__dirname, "../../data/items.json");

let cachedItems: ItemDefinition[] | undefined;
let cachedItemsById: Map<number, ItemDefinition> | undefined;

function normalizeBonuses(bonuses: number[] | undefined): ItemBonuses | undefined {
    if (!Array.isArray(bonuses) || bonuses.length !== 14) return undefined;
    const normalized = bonuses.slice();
    if (normalized.some((value) => Number.isNaN(value))) return undefined;
    return normalized as unknown as ItemBonuses;
}

function normalizeRequirements(req: number[] | undefined): ItemRequirements | undefined {
    if (!Array.isArray(req) || req.length !== 23) return undefined;
    const normalized = req.slice();
    if (normalized.some((value) => Number.isNaN(value))) return undefined;
    return normalized as unknown as ItemRequirements;
}

function toItemDefinition(raw: RawItem): ItemDefinition {
    const weight = raw.weight;
    return {
        id: raw.id,
        name: raw.name ?? "",
        examine: raw.examine ?? "",
        equipmentType: raw.equipmentType,
        weaponInterface: raw.weaponInterface,
        doubleHanded: raw.doubleHanded,
        stackable: raw.stackable,
        tradeable: raw.tradeable,
        dropable: raw.dropable,
        sellable: raw.sellable,
        noted: raw.noted,
        value: raw.value,
        bloodMoneyValue: raw.bloodMoneyValue,
        highAlch: raw.highAlch,
        lowAlch: raw.lowAlch,
        dropValue: raw.dropValue,
        noteId: raw.noteId,
        blockAnim: raw.blockAnim,
        standAnim: raw.standAnim,
        walkAnim: raw.walkAnim,
        runAnim: raw.runAnim,
        standTurnAnim: raw.standTurnAnim,
        turn180Anim: raw.turn180Anim,
        turn90CWAnim: raw.turn90CWAnim,
        turn90CCWAnim: raw.turn90CCWAnim,
        weight: Number.isFinite(weight) ? weight : 0,
        bonuses: normalizeBonuses(raw.bonuses),
        requirements: normalizeRequirements(raw.requirements),
    };
}

export function loadItemDefinitions(): ItemDefinition[] {
    if (!cachedItems) {
        const text = fs.readFileSync(ITEMS_PATH, "utf8");
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            throw new Error("items.json must be an array");
        }
        const items = parsed.map((entry) => toItemDefinition(entry as RawItem));
        cachedItems = items;
        cachedItemsById = new Map(items.map((item) => [item.id, item]));
    }
    return cachedItems;
}

export function getItemDefinition(itemId: number): ItemDefinition | undefined {
    if (!cachedItemsById) loadItemDefinitions();

    // Check cache first
    const cached = cachedItemsById?.get(itemId);
    if (cached) return cached;

    // Check for custom items
    const customItem = CustomItemRegistry.get(itemId);
    if (customItem) {
        const def = customItem.definition;

        // If based on an existing item, inherit from it
        let baseDef: ItemDefinition | undefined;
        if (def.baseItemId !== undefined) {
            baseDef = cachedItemsById?.get(def.baseItemId);
        }

        // Build ItemDefinition from custom item
        const itemDef: ItemDefinition = {
            id: itemId,
            name: def.objType.name ?? baseDef?.name ?? "null",
            examine: def.objType.examine ?? baseDef?.examine ?? "",
            equipmentType: def.itemDef.equipmentType ?? baseDef?.equipmentType,
            weaponInterface: def.itemDef.weaponInterface ?? baseDef?.weaponInterface,
            doubleHanded: def.itemDef.doubleHanded ?? baseDef?.doubleHanded ?? false,
            stackable: def.itemDef.stackable ?? baseDef?.stackable ?? false,
            tradeable: def.itemDef.tradeable ?? baseDef?.tradeable ?? false,
            dropable: def.itemDef.dropable ?? baseDef?.dropable ?? true,
            sellable: def.itemDef.sellable ?? baseDef?.sellable ?? false,
            noted: false,
            value: def.itemDef.value ?? baseDef?.value ?? 0,
            bloodMoneyValue: def.itemDef.bloodMoneyValue ?? baseDef?.bloodMoneyValue,
            highAlch: def.itemDef.highAlch ?? baseDef?.highAlch ?? 0,
            lowAlch: def.itemDef.lowAlch ?? baseDef?.lowAlch ?? 0,
            dropValue: def.itemDef.dropValue ?? baseDef?.dropValue ?? 0,
            noteId: baseDef?.noteId ?? 0,
            blockAnim: def.itemDef.blockAnim ?? baseDef?.blockAnim ?? 0,
            standAnim: def.itemDef.standAnim ?? baseDef?.standAnim ?? 0,
            walkAnim: def.itemDef.walkAnim ?? baseDef?.walkAnim ?? 0,
            runAnim: def.itemDef.runAnim ?? baseDef?.runAnim ?? 0,
            standTurnAnim: def.itemDef.standTurnAnim ?? baseDef?.standTurnAnim ?? 0,
            turn180Anim: def.itemDef.turn180Anim ?? baseDef?.turn180Anim ?? 0,
            turn90CWAnim: def.itemDef.turn90CWAnim ?? baseDef?.turn90CWAnim ?? 0,
            turn90CCWAnim: def.itemDef.turn90CCWAnim ?? baseDef?.turn90CCWAnim ?? 0,
            weight: def.objType.weight ?? baseDef?.weight ?? 0,
            bonuses: def.itemDef.bonuses ?? baseDef?.bonuses,
            requirements: def.itemDef.requirements ?? baseDef?.requirements,
        };

        // Cache it for future lookups
        cachedItemsById?.set(itemId, itemDef);
        return itemDef;
    }

    return undefined;
}
