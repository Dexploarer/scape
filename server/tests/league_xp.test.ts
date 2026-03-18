import assert from "assert";

import {
    LEAGUE_V_XP_MULTIPLIER,
    getLeagueSkillXpMultiplier,
    getLeagueVSkillXpMultiplier,
} from "../src/game/leagues/leagueXp";

function testLeagueVMultiplierThresholds(): void {
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(0),
        LEAGUE_V_XP_MULTIPLIER.base,
        "league v should start at 5x",
    );
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(749),
        LEAGUE_V_XP_MULTIPLIER.base,
        "league v should stay 5x below 750 points",
    );
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(750),
        LEAGUE_V_XP_MULTIPLIER.tier2,
        "league v should become 8x at 750 points",
    );
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(4999),
        LEAGUE_V_XP_MULTIPLIER.tier2,
        "league v should stay 8x below 5000 points",
    );
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(5000),
        LEAGUE_V_XP_MULTIPLIER.tier5,
        "league v should become 12x at 5000 points",
    );
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(15999),
        LEAGUE_V_XP_MULTIPLIER.tier5,
        "league v should stay 12x below 16000 points",
    );
    assert.strictEqual(
        getLeagueVSkillXpMultiplier(16000),
        LEAGUE_V_XP_MULTIPLIER.tier7,
        "league v should become 16x at 16000 points",
    );
}

function testLeagueTypeGating(): void {
    assert.strictEqual(
        getLeagueSkillXpMultiplier(0, 50000),
        1,
        "non-league types should not apply league multipliers",
    );
    assert.strictEqual(
        getLeagueSkillXpMultiplier(5, 5000),
        LEAGUE_V_XP_MULTIPLIER.tier5,
        "league type 5 should apply league v multiplier",
    );
}

testLeagueVMultiplierThresholds();
testLeagueTypeGating();

console.log("League XP multiplier tests passed.");
