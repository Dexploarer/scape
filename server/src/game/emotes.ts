// Auto-generated from cache enum_1000 and reference name-to-seq mapping.
// Unmapped entries fall back to client-suggested seq at runtime.

export const EMOTE_SEQ_MAP: Partial<Record<number, number>> = {
    0: 855, // Yes
    1: 856, // No
    2: 858, // Bow
    3: 859, // Angry
    4: 857, // Think
    5: 863, // Wave
    6: 2113, // Shrug
    7: 862, // Cheer
    8: 864, // Beckon
    9: 861, // Laugh
    10: 2109, // Jump for Joy
    11: 2111, // Yawn
    12: 866, // Dance
    13: 2106, // Jig
    14: 2107, // Spin
    15: 2108, // Headbang
    16: 860, // Cry
    17: 1374, // Blow Kiss
    18: 2105, // Panic
    19: 2110, // Raspberry
    20: 865, // Clap
    21: 2112, // Salute
    24: 1131, // Glass Box
    25: 1130, // Climb Rope
    26: 1129, // Lean
    27: 1128, // Glass Wall
    28: 4276, // Idea
    29: 4278, // Stamp
    31: 4275, // Slap Head
    32: 3544, // Zombie Walk
    34: 2836, // Scared
    35: 6111, // Rabbit Hop
    41: 1708, // Zombie Hand
    44: 4751, // Air Guitar
    36: 874, // Sit up
    37: 872, // Push up
    38: 870, // Star jump
    39: 868, // Jog
    40: 8917, // Flex
    42: 7131, // Hypermobile Drinker
    45: 7278, // Uri transform
    46: 10048, // Smooth dance
    47: 10051, // Crazy dance
    48: 7751, // Premier Shield
    49: 8541, // Explore
    50: 9208, // Relic unlock
    51: 10031, // Party
    52: 10503, // Trick
    53: 10796, // Fortis Salute
    54: 10053, // Sit down
    // 22: ?, // Goblin Bow
    // 23: ?, // Goblin Salute
    // 30: ?, // Flap
    // 33: ?, // Zombie Dance
    // 43: ?, // Skill Cape
};

export function getEmoteSeq(index: number): number | undefined {
    const id = EMOTE_SEQ_MAP[index];
    if (id !== undefined && id >= 0) return id;
    return undefined;
}
