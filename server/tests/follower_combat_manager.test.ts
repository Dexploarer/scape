import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    hasDirectMeleeReach,
    isWithinAttackRange,
    walkToAttackRange,
} from "../src/game/combat/CombatAction";
import { FollowerCombatManager } from "../src/game/followers/FollowerCombatManager";
import type { ActiveFollowerSnapshot } from "../src/game/followers/FollowerManager";
import {
    LIL_CREATOR_ITEM_ID,
    LIL_CREATOR_NPC_TYPE_ID,
} from "../src/game/followers/followerDefinitions";
import { NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";

vi.mock("../src/game/combat/CombatAction", () => ({
    hasDirectMeleeReach: vi.fn(() => true),
    isWithinAttackRange: vi.fn(() => true),
    walkToAttackRange: vi.fn(),
}));

function createMockPlayer(id: number, overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        id,
        tileX: 3200,
        tileY: 3200,
        level: 0,
        getCombatTarget: vi.fn(() => null),
        ...overrides,
    } as unknown as PlayerState;
}

function createMockNpc(id: number, overrides: Partial<NpcState> = {}): NpcState {
    return Object.assign(Object.create(NpcState.prototype), {
        id,
        typeId: LIL_CREATOR_NPC_TYPE_ID,
        tileX: 3201,
        tileY: 3200,
        level: 0,
        size: 1,
        isDead: vi.fn(() => false),
        isInCombat: vi.fn(() => false),
        getCombatTargetPlayerId: vi.fn(() => undefined),
        clearPath: vi.fn(),
        hasPath: vi.fn(() => false),
        setInteraction: vi.fn(),
        ...overrides,
    }) as NpcState;
}

function createFollowerProviderMock(activeFollowers: ActiveFollowerSnapshot[]) {
    return {
        forEachActiveFollower(visitor: (follower: ActiveFollowerSnapshot) => void): void {
            for (const follower of activeFollowers) {
                visitor(follower);
            }
        },
    };
}

describe("FollowerCombatManager", () => {
    let activeFollowers: ActiveFollowerSnapshot[];
    let players: Map<number, PlayerState>;
    let npcs: Map<number, NpcState>;
    let owner: PlayerState;
    let companion: NpcState;
    let target: NpcState;
    let onFollowerAttack: ReturnType<typeof vi.fn>;
    let manager: FollowerCombatManager;

    beforeEach(() => {
        activeFollowers = [
            {
                playerId: 1,
                npcId: 100,
                itemId: LIL_CREATOR_ITEM_ID,
                npcTypeId: LIL_CREATOR_NPC_TYPE_ID,
            },
        ];
        players = new Map<number, PlayerState>();
        npcs = new Map<number, NpcState>();
        owner = createMockPlayer(1);
        companion = createMockNpc(100);
        target = createMockNpc(200, { typeId: 1 });
        players.set(owner.id, owner);
        npcs.set(companion.id, companion);
        npcs.set(target.id, target);
        onFollowerAttack = vi.fn(() => true);

        vi.mocked(isWithinAttackRange).mockReturnValue(true);
        vi.mocked(hasDirectMeleeReach).mockReturnValue(true);
        vi.mocked(walkToAttackRange).mockReset();

        manager = new FollowerCombatManager(
            createFollowerProviderMock(activeFollowers),
            {
                getById: (id: number) => npcs.get(id),
            } as any,
            {
                getById: (id: number) => players.get(id),
            },
            {} as any,
            onFollowerAttack,
        );
    });

    it("does not assist before the target is actually fighting the owner", () => {
        owner = createMockPlayer(1, {
            getCombatTarget: vi.fn(() => target),
        });
        players.set(owner.id, owner);

        manager.tick(100);

        expect(onFollowerAttack).not.toHaveBeenCalled();
        expect(companion.setInteraction).not.toHaveBeenCalled();
    });

    it("does not assist until the follower's summon delay has elapsed", () => {
        activeFollowers = [
            {
                playerId: 1,
                npcId: 100,
                itemId: LIL_CREATOR_ITEM_ID,
                npcTypeId: LIL_CREATOR_NPC_TYPE_ID,
                followReadyTick: 101,
            },
        ];
        owner = createMockPlayer(1, {
            getCombatTarget: vi.fn(() => target),
        });
        target = createMockNpc(200, {
            typeId: 1,
            isInCombat: vi.fn(() => true),
            getCombatTargetPlayerId: vi.fn(() => owner.id),
        });
        players.set(owner.id, owner);
        npcs.set(target.id, target);
        manager = new FollowerCombatManager(
            createFollowerProviderMock(activeFollowers),
            {
                getById: (id: number) => npcs.get(id),
            } as any,
            {
                getById: (id: number) => players.get(id),
            },
            {} as any,
            onFollowerAttack,
        );

        manager.tick(100);
        expect(onFollowerAttack).not.toHaveBeenCalled();

        manager.tick(101);
        expect(onFollowerAttack).toHaveBeenCalledTimes(1);
    });

    it("assists once the owner's target is fighting them", () => {
        owner = createMockPlayer(1, {
            getCombatTarget: vi.fn(() => target),
        });
        target = createMockNpc(200, {
            typeId: 1,
            isInCombat: vi.fn(() => true),
            getCombatTargetPlayerId: vi.fn(() => owner.id),
        });
        players.set(owner.id, owner);
        npcs.set(target.id, target);

        manager.tick(100);

        expect(companion.setInteraction).toHaveBeenCalledWith("npc", target.id);
        expect(onFollowerAttack).toHaveBeenCalledTimes(1);
        expect(onFollowerAttack).toHaveBeenCalledWith(
            expect.objectContaining({
                owner,
                companion,
                target,
                currentTick: 100,
            }),
        );
        expect((manager as any).stateByPlayerId.get(owner.id)).toEqual({
            npcId: companion.id,
            currentTargetNpcId: target.id,
            nextAttackTick: 104,
        });
    });

    it("does not assist targets fighting another player", () => {
        owner = createMockPlayer(1, {
            getCombatTarget: vi.fn(() => target),
        });
        target = createMockNpc(200, {
            typeId: 1,
            isInCombat: vi.fn(() => true),
            getCombatTargetPlayerId: vi.fn(() => 2),
        });
        players.set(owner.id, owner);
        npcs.set(target.id, target);

        manager.tick(100);

        expect(onFollowerAttack).not.toHaveBeenCalled();
        expect(companion.setInteraction).not.toHaveBeenCalled();
    });

    it("resets attack cadence when the player companion state is reset", () => {
        owner = createMockPlayer(1, {
            getCombatTarget: vi.fn(() => target),
        });
        target = createMockNpc(200, {
            typeId: 1,
            isInCombat: vi.fn(() => true),
            getCombatTargetPlayerId: vi.fn(() => owner.id),
        });
        players.set(owner.id, owner);
        npcs.set(target.id, target);

        manager.tick(100);
        manager.tick(101);
        expect(onFollowerAttack).toHaveBeenCalledTimes(1);

        manager.resetPlayer(owner.id);
        manager.tick(101);

        expect(onFollowerAttack).toHaveBeenCalledTimes(2);
    });
});
