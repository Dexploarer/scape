import assert from "assert";

import {
    buildGroundItemMenuEntries,
    buildLocMenuEntries,
    buildNpcMenuEntries,
} from "../../src/client/menu/WorldMenuBuilder";
import { MenuTargetType } from "../../src/rs/MenuEntry";
import {
    resolveLocExamineText,
    resolveNpcExamineText,
    resolveObjExamineText,
} from "../src/game/interactions/ExamineText";

function main(): void {
    const callbacks: any = {
        onExamine: () => {},
        onUseItemOn: () => {},
        onTakeGroundItem: () => {},
        onExamineGroundItem: () => {},
        onAttackNpc: () => {},
        onInteractNpc: () => {},
        onFollowPlayer: () => {},
        onTradePlayer: () => {},
        closeMenu: () => {},
    };

    {
        const { examine } = buildLocMenuEntries(
            {
                id: 100,
                name: "Gate",
                actions: [null, null, "Open", null, null],
            } as any,
            10,
            20,
            {
                activeSpell: null,
                selectedItem: null,
                debugId: false,
                npcAttackOption: 0,
                localPlayerCombatLevel: 1,
                followerOpsLowPriority: false,
            },
            callbacks,
        );
        assert.ok(examine);
        assert.strictEqual(examine?.targetType, MenuTargetType.LOC);
        assert.strictEqual(examine?.targetId, 100);
        assert.strictEqual(examine?.onClick, undefined);
    }

    {
        const { examine } = buildNpcMenuEntries(
            {
                id: 7413,
                name: "Zulrah",
                actions: [],
                combatLevel: 725,
                isFollower: false,
            } as any,
            15,
            25,
            {
                activeSpell: null,
                selectedItem: null,
                debugId: false,
                npcAttackOption: 0,
                localPlayerCombatLevel: 126,
                followerOpsLowPriority: false,
            },
            callbacks,
            () => undefined,
        );
        assert.ok(examine);
        assert.strictEqual(examine?.targetType, MenuTargetType.NPC);
        assert.strictEqual(examine?.targetId, 7413);
        assert.strictEqual(examine?.onClick, undefined);
    }

    {
        const { actions, examine } = buildGroundItemMenuEntries(
            {
                id: 995,
                name: "Coins",
                groundActions: [null, null, null, null, null],
            } as any,
            4001,
            { id: 4001, itemId: 995 },
            30,
            40,
            {
                activeSpell: null,
                selectedItem: null,
                debugId: false,
                npcAttackOption: 0,
                localPlayerCombatLevel: 126,
                followerOpsLowPriority: false,
            },
            callbacks,
        );
        assert.ok(examine);
        assert.strictEqual(examine?.targetType, MenuTargetType.OBJ);
        assert.strictEqual(examine?.targetId, 995);
        assert.strictEqual(examine?.onClick, undefined);
        assert.ok(actions.length > 0);
        assert.strictEqual(actions[0]?.targetId, 995);
    }

    {
        const locLoader = {
            load(id: number) {
                if (id === 10) {
                    return {
                        id: 10,
                        desc: "Base text",
                        transforms: [20, -1],
                        transformVarbit: 1,
                        transformVarp: -1,
                    };
                }
                if (id === 20) {
                    return { id: 20, desc: "A transformed gate." };
                }
                return undefined;
            },
        };
        const player = {
            getVarbitValue(varbitId: number) {
                return varbitId === 1 ? 0 : 0;
            },
            getVarpValue() {
                return 0;
            },
        };
        assert.strictEqual(resolveLocExamineText(locLoader, player, 10), "A transformed gate.");
    }

    {
        const npcLoader = {
            load(id: number) {
                return id === 7413 ? { desc: "The mighty serpent of Zul-Andra." } : undefined;
            },
        };
        assert.strictEqual(
            resolveNpcExamineText(npcLoader, 7413),
            "The mighty serpent of Zul-Andra.",
        );
    }

    {
        const objLoader = {
            load(id: number) {
                return id === 995 ? { examine: "Lovely money!" } : undefined;
            },
        };
        assert.strictEqual(resolveObjExamineText(objLoader, 995), "Lovely money!");
    }

    {
        assert.strictEqual(
            resolveLocExamineText(
                undefined,
                {
                    getVarbitValue() {
                        return 0;
                    },
                    getVarpValue() {
                        return 0;
                    },
                },
                10,
            ),
            undefined,
        );
        assert.strictEqual(resolveNpcExamineText(undefined, 1), undefined);
    }

    console.log("Examine parity tests passed.");
}

main();
