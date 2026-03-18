import { SkillId } from "../../../src/rs/skill/skills";

// Cache parity: interface 233 component ids in this revision do not match newer RuneLite constants.
// Verified against cache group 233.
export const LEVELUP_INTERFACE_ID = 233;
export const LEVELUP_TEXT1_COMPONENT = 1;
export const LEVELUP_TEXT2_COMPONENT = 2;
export const LEVELUP_CONTINUE_COMPONENT = 3;
export const LEVELUP_COMBAT_COMPONENT = 55;
export const LEVELUP_SAILING_COMPONENT = 57;

export const LEVELUP_SKILL_COMPONENT_BY_SKILL: Readonly<Partial<Record<number, number>>> = {
    [SkillId.Agility]: 4,
    [SkillId.Attack]: 6,
    [SkillId.Construction]: 9,
    [SkillId.Cooking]: 12,
    [SkillId.Crafting]: 14,
    [SkillId.Defence]: 17,
    [SkillId.Farming]: 19,
    [SkillId.Firemaking]: 21,
    [SkillId.Fishing]: 23,
    [SkillId.Fletching]: 25,
    [SkillId.Herblore]: 28,
    [SkillId.Hitpoints]: 30,
    [SkillId.Hunter]: 32,
    [SkillId.Magic]: 34,
    [SkillId.Mining]: 36,
    [SkillId.Prayer]: 38,
    [SkillId.Ranged]: 40,
    [SkillId.Runecraft]: 43,
    [SkillId.Slayer]: 45,
    [SkillId.Smithing]: 47,
    [SkillId.Strength]: 49,
    [SkillId.Thieving]: 51,
    [SkillId.Woodcutting]: 53,
    [SkillId.Sailing]: LEVELUP_SAILING_COMPONENT,
};
