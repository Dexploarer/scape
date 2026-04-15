import { expect, test } from "bun:test";

import type {
    ActionScheduleRequest as CombatActionScheduleRequest,
    ActionScheduleResult as CombatActionScheduleResult,
    ProjectileTiming as CombatProjectileTiming,
    SoundRequest as CombatSoundRequest,
    SpotAnimRequest as CombatSpotAnimRequest,
} from "../server/src/game/actions/handlers/CombatActionHandler";
import type {
    ActionScheduleRequest as InventoryActionScheduleRequest,
    ActionScheduleResult as InventoryActionScheduleResult,
} from "../server/src/game/actions/handlers/InventoryActionHandler";
import type {
    ActionScheduleRequest as SharedActionScheduleRequest,
    ActionScheduleResult as SharedActionScheduleResult,
    ProjectileTiming as SharedProjectileTiming,
    SoundBroadcastRequest as SharedSoundBroadcastRequest,
    SoundRequest as SharedSoundRequest,
    SpotAnimRequest as SharedSpotAnimRequest,
} from "../server/src/game/actions/handlers/HandlerSupportContracts";
import type {
    ActionScheduleRequest as SpellActionScheduleRequest,
    ActionScheduleResult as SpellActionScheduleResult,
    ProjectileTiming as SpellProjectileTiming,
    SoundBroadcastRequest as SpellSoundBroadcastRequest,
    SpotAnimRequest as SpellSpotAnimRequest,
} from "../server/src/game/actions/handlers/SpellActionHandler";
import type { SoundBroadcastRequest as ManagerSoundBroadcastRequest } from "../server/src/network/managers/SoundManager";

test("shared handler support contracts stay aligned across handlers", () => {
    const timing = {
        startDelay: 1,
        travelTime: 3,
        hitDelay: 4,
        lineOfSight: true,
    } satisfies SharedProjectileTiming;

    const combatTiming: CombatProjectileTiming = timing;
    const spellTiming: SpellProjectileTiming = timing;
    expect(combatTiming).toEqual(spellTiming);

    const spotAnim = {
        tick: 100,
        playerId: 7,
        npcId: 9,
        slot: 1,
        spotId: 125,
        delay: 2,
        height: 32,
        tile: { x: 3200, y: 3201, level: 0 },
    } satisfies SharedSpotAnimRequest;

    const combatSpotAnim: CombatSpotAnimRequest = spotAnim;
    const spellSpotAnim: SpellSpotAnimRequest = spotAnim;
    expect(combatSpotAnim).toEqual(spellSpotAnim);

    const sound = {
        soundId: 227,
        x: 3200,
        y: 3201,
        level: 0,
        delay: 1,
    } satisfies SharedSoundBroadcastRequest;

    const combatSound: CombatSoundRequest = sound;
    const spellSound: SpellSoundBroadcastRequest = sound;
    const managerSound: ManagerSoundBroadcastRequest = sound;
    const sharedSound: SharedSoundRequest = sound;
    expect(combatSound).toEqual(spellSound);
    expect(managerSound).toEqual(sharedSound);

    const scheduleResult = {
        ok: true,
    } satisfies SharedActionScheduleResult;

    const combatResult: CombatActionScheduleResult = scheduleResult;
    const spellResult: SpellActionScheduleResult = scheduleResult;
    const inventoryResult: InventoryActionScheduleResult = scheduleResult;
    expect(combatResult).toEqual(spellResult);
    expect(inventoryResult).toEqual(scheduleResult);

    const scheduleRequest = {
        kind: "combat.playerHit",
        data: { npcId: 1 },
        delayTicks: 2,
        cooldownTicks: 1,
        groups: ["combat"],
    } satisfies SharedActionScheduleRequest<"combat.playerHit">;

    const combatRequest: CombatActionScheduleRequest<"combat.playerHit"> = scheduleRequest;
    const spellRequest: SpellActionScheduleRequest<"combat.playerHit"> = scheduleRequest;
    const inventoryRequest: InventoryActionScheduleRequest<"combat.playerHit"> = scheduleRequest;
    expect(combatRequest).toEqual(spellRequest);
    expect(inventoryRequest).toEqual(scheduleRequest);
});
