/**
 * Server-side spell widget loader
 * Uses explicit widget ID mappings from RuneLite's InterfaceID.java for OSRS parity.
 * All spells are in the unified spellbook interface (group 218).
 */
import { CacheSystem } from "../../../src/rs/cache/CacheSystem";

// All spells use the unified spellbook interface (group 218)
export const SPELLBOOK_GROUP_ID = 218;

/**
 * Explicit spell name -> widget child ID mappings from RuneLite InterfaceID.java
 * These are the canonical OSRS widget IDs.
 */
const SPELL_WIDGET_IDS: Record<string, number> = {
    // Standard combat spells
    "Wind Strike": 8,
    "Water Strike": 11,
    "Earth Strike": 14,
    "Fire Strike": 16,
    "Wind Bolt": 18,
    "Water Bolt": 22,
    "Earth Bolt": 25,
    "Fire Bolt": 28,
    "Wind Blast": 32,
    "Water Blast": 35,
    "Earth Blast": 42,
    "Fire Blast": 48,
    "Wind Wave": 55,
    "Water Wave": 58,
    "Earth Wave": 62,
    "Fire Wave": 65,
    "Wind Surge": 69,
    "Water Surge": 71,
    "Earth Surge": 76,
    "Fire Surge": 78,

    // Standard utility/debuff spells
    Confuse: 9,
    Weaken: 15,
    Curse: 19,
    Bind: 20,
    Snare: 39,
    Entangle: 66,
    Vulnerability: 60,
    Enfeeble: 63,
    Stun: 67,

    // Standard special combat spells
    "Crumble Undead": 30,
    "Iban Blast": 38,
    "Magic Dart": 40,
    "Saradomin Strike": 51,
    "Claws of Guthix": 52,
    "Flames of Zamorak": 53,

    // Standard item spells
    "Low Level Alchemy": 21,
    "High Level Alchemy": 44,
    "Superheat Item": 33,
    "Bones to Bananas": 17,
    "Telekinetic Grab": 27,
    "Charge Water Orb": 45,
    "Charge Earth Orb": 49,
    "Charge Fire Orb": 56,
    "Charge Air Orb": 59,

    // Ancient Magicks combat spells
    "Ice Rush": 81,
    "Ice Blitz": 82,
    "Ice Burst": 83,
    "Ice Barrage": 84,
    "Blood Rush": 85,
    "Blood Blitz": 86,
    "Blood Burst": 87,
    "Blood Barrage": 88,
    "Smoke Rush": 89,
    "Smoke Blitz": 90,
    "Smoke Burst": 91,
    "Smoke Barrage": 92,
    "Shadow Rush": 93,
    "Shadow Blitz": 94,
    "Shadow Burst": 95,
    "Shadow Barrage": 96,

    // Arceuus combat spells
    "Inferior Demonbane": 169,
    "Superior Demonbane": 170,
    "Dark Demonbane": 171,
    "Ghostly Grasp": 173,
    "Skeletal Grasp": 174,
    "Undead Grasp": 175,
    "Lesser Corruption": 177,
    "Greater Corruption": 178,
    "Mark of Darkness": 172,

    // Lunar spells (targetable/utility)
    "Monster Examine": 109,
    "NPC Contact": 110,
    "Cure Other": 111,
    "Cure Me": 115,
    "Cure Group": 119,
    "Stat Spy": 120,
    Dream: 127,
    "Energy Transfer": 141,
    "Heal Other": 142,
    "Vengeance Other": 143,
    Vengeance: 144,
    "Heal Group": 145,
    "Spellbook Swap": 146,

    // Standard teleports
    "Home Teleport": 7,
    "Minigame Teleport": 8,
    "Varrock Teleport": 23,
    "Lumbridge Teleport": 26,
    "Falador Teleport": 29,
    "Teleport to House": 31,
    "Camelot Teleport": 34,
    "Kourend Castle Teleport": 36,
    "Ardougne Teleport": 41,
    "Watchtower Teleport": 47,
    "Trollheim Teleport": 54,
    "Ape Atoll Teleport": 57,

    // Ancient teleports
    "Paddewwa Teleport": 97,
    "Senntisten Teleport": 98,
    "Kharyrll Teleport": 99,
    "Lassar Teleport": 100,
    "Dareeyak Teleport": 101,
    "Carrallangar Teleport": 102,
    "Annakarl Teleport": 103,
    "Ghorrock Teleport": 104,

    // Arceuus teleports
    "Arceuus Home Teleport": 150,
    "Arceuus Library Teleport": 152,
    "Draynor Manor Teleport": 156,
    "Mind Altar Teleport": 158,
    "Salve Graveyard Teleport": 160,
    "Fenkenstrain's Castle Teleport": 161,
    "West Ardougne Teleport": 162,
    "Harmony Island Teleport": 164,
    "Barrows Teleport": 166,
    "Ape Atoll Teleport (Arceuus)": 168,
};

/**
 * Build a spell name -> (groupId, fileId) lookup.
 * Uses explicit widget ID mappings for reliability.
 */
export function buildSpellNameToWidgetMap(
    _cache: CacheSystem,
): Map<string, { groupId: number; fileId: number }> {
    const result = new Map<string, { groupId: number; fileId: number }>();

    for (const [spellName, fileId] of Object.entries(SPELL_WIDGET_IDS)) {
        result.set(spellName.toLowerCase(), { groupId: SPELLBOOK_GROUP_ID, fileId });
    }

    console.log(`[SpellWidgetLoader] Loaded ${result.size} spell widget mappings`);
    return result;
}

/**
 * Get widget ID for a spell by name (direct lookup)
 */
export function getSpellWidgetId(spellName: string): number | undefined {
    return SPELL_WIDGET_IDS[spellName];
}
