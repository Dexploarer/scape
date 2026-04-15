import { expect, test } from "bun:test";

import type {
    GroundItemActionPayload as ClientGroundItemActionPayload,
    SpellResultPayload as ClientSpellResultPayload,
} from "../src/network/ServerConnection";
import type {
    GroundItemActionPayload as ServerGroundItemActionPayload,
    SpellCastNpcPayload as ServerSpellCastNpcPayload,
    SpellResultPayload as ServerSpellResultPayload,
} from "../server/src/network/messages";
import type {
    SpellCastRequest as CombatSpellCastRequest,
} from "../server/src/game/actions/handlers/CombatActionHandler";
import type {
    GroundItemActionPayload as HandlerGroundItemActionPayload,
    GroundItemsServerPayload as HandlerGroundItemsServerPayload,
} from "../server/src/network/managers/GroundItemHandler";
import type {
    SpellCastNpcPayload as HandlerSpellCastNpcPayload,
    SpellCastRequest as HandlerSpellCastRequest,
    SpellTargetKind as HandlerSpellTargetKind,
    SpellResultPayload as HandlerSpellResultPayload,
    SpellCastModifiers as HandlerSpellCastModifiers,
} from "../server/src/game/actions/handlers/SpellActionHandler";
import type {
    GroundItemActionPayload as SharedGroundItemActionPayload,
    GroundItemsServerPayload as SharedGroundItemsServerPayload,
    SpellCastNpcPayload as SharedSpellCastNpcPayload,
    SpellCastModifiers as SharedSpellCastModifiers,
    SpellResultPayload as SharedSpellResultPayload,
} from "../src/shared/network/GameMessageDtos";
import type {
    SpellCastRequest as SharedSpellCastRequest,
    SpellTargetKind as SharedSpellTargetKind,
} from "../src/shared/spells/SpellActionContracts";

test("shared ground item and spell result DTOs stay aligned", () => {
    const groundItemAction = {
        stackId: 99,
        tile: { x: 3200, y: 3201, level: 1 },
        itemId: 995,
        quantity: 100,
        option: "take",
        opNum: 3,
        modifierFlags: 2,
    } satisfies SharedGroundItemActionPayload;

    const serverGroundItemAction: ServerGroundItemActionPayload = groundItemAction;
    const clientGroundItemAction: ClientGroundItemActionPayload = groundItemAction;
    const handlerGroundItemAction: HandlerGroundItemActionPayload = groundItemAction;

    expect(serverGroundItemAction).toEqual(clientGroundItemAction);
    expect(handlerGroundItemAction).toEqual(clientGroundItemAction);
    expect(clientGroundItemAction.opNum).toBe(3);
    expect(clientGroundItemAction.modifierFlags).toBe(2);

    const spellResult = {
        casterId: 7,
        spellId: 1183,
        outcome: "success",
        targetType: "item",
        targetId: 4151,
        runesConsumed: [{ itemId: 554, quantity: 5 }],
        modifiers: { castMode: "manual" },
    } satisfies SharedSpellResultPayload;

    const serverSpellResult: ServerSpellResultPayload = spellResult;
    const clientSpellResult: ClientSpellResultPayload = spellResult;
    const handlerSpellResult: HandlerSpellResultPayload = spellResult;

    expect(serverSpellResult.targetType).toBe("item");
    expect(clientSpellResult.targetType).toBe("item");
    expect(handlerSpellResult.targetType).toBe("item");
    expect(clientSpellResult.runesConsumed).toEqual([{ itemId: 554, quantity: 5 }]);
});

test("internal handlers re-export the shared DTO contracts", () => {
    const modifiers = {
        isAutocast: true,
        castMode: "autocast",
    } satisfies SharedSpellCastModifiers;

    const handlerModifiers: HandlerSpellCastModifiers = modifiers;
    expect(handlerModifiers).toEqual(modifiers);

    const groundSnapshot = {
        kind: "snapshot",
        serial: 5,
        stacks: [
            {
                id: 1,
                itemId: 526,
                quantity: 1,
                tile: { x: 3200, y: 3200, level: 0 },
                ownership: 1,
            },
        ],
    } satisfies SharedGroundItemsServerPayload;

    const handlerSnapshot: HandlerGroundItemsServerPayload = groundSnapshot;
    expect(handlerSnapshot).toEqual(groundSnapshot);
});

test("spell cast payloads and execution requests stay aligned", () => {
    const npcPayload = {
        spellId: 1152,
        spellbookGroupId: 218,
        widgetChildId: 8,
        selectedSpellWidgetId: (218 << 16) | 8,
        selectedSpellChildIndex: 8,
        selectedSpellItemId: -1,
        modifiers: { castMode: "manual" },
        npcId: 42,
    } satisfies SharedSpellCastNpcPayload;

    const serverNpcPayload: ServerSpellCastNpcPayload = npcPayload;
    const handlerNpcPayload: HandlerSpellCastNpcPayload = npcPayload;

    expect(serverNpcPayload).toEqual(handlerNpcPayload);

    const request = {
        spellId: 1152,
        modifiers: { isAutocast: true, castMode: "autocast" },
        target: { type: "player", playerId: 7 },
    } satisfies SharedSpellCastRequest;

    const combatRequest: CombatSpellCastRequest = request;
    const handlerRequest: HandlerSpellCastRequest = request;
    const targetKind: SharedSpellTargetKind = "npc";
    const handlerTargetKind: HandlerSpellTargetKind = targetKind;

    expect(combatRequest).toEqual(handlerRequest);
    expect(handlerTargetKind).toBe("npc");
});
