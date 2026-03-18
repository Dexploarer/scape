/**
 * Combat State Machine Tests
 *
 * Tests for explicit combat state transitions.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { CombatPhase, CombatStateMachineContext } from "../src/game/combat/CombatState";
import {
    CombatStateMachine,
    createCombatStateMachine,
} from "../src/game/combat/CombatStateMachine";

describe("CombatStateMachine", () => {
    let sm: CombatStateMachine;

    beforeEach(() => {
        sm = createCombatStateMachine();
    });

    describe("initial state", () => {
        it("starts in Idle phase", () => {
            expect(sm.getState()).toBe(CombatPhase.Idle);
        });

        it("isInCombat returns false initially", () => {
            expect(sm.isInCombat()).toBe(false);
        });

        it("isFrozen returns false initially", () => {
            expect(sm.isFrozen()).toBe(false);
        });
    });

    describe("startCombat", () => {
        it("transitions from Idle to Approaching", () => {
            const transition = sm.startCombat(0);
            expect(transition).not.toBeNull();
            expect(transition!.from).toBe(CombatPhase.Idle);
            expect(transition!.to).toBe(CombatPhase.Approaching);
            expect(sm.getState()).toBe(CombatPhase.Approaching);
        });

        it("records tick and reason", () => {
            const transition = sm.startCombat(42);
            expect(transition!.tick).toBe(42);
            expect(transition!.reason).toBe("combat_started");
        });

        it("returns null if already in combat", () => {
            sm.startCombat(0);
            const secondTransition = sm.startCombat(1);
            expect(secondTransition).toBeNull();
            expect(sm.getState()).toBe(CombatPhase.Approaching);
        });

        it("sets isInCombat to true", () => {
            sm.startCombat(0);
            expect(sm.isInCombat()).toBe(true);
        });
    });

    describe("endCombat", () => {
        it("transitions to Idle from any state", () => {
            sm.startCombat(0);
            const transition = sm.endCombat(1, "player_canceled");
            expect(transition.from).toBe(CombatPhase.Approaching);
            expect(transition.to).toBe(CombatPhase.Idle);
            expect(sm.getState()).toBe(CombatPhase.Idle);
        });

        it("records the reason", () => {
            sm.startCombat(0);
            const transition = sm.endCombat(1, "target_out_of_range");
            expect(transition.reason).toBe("target_out_of_range");
        });

        it("sets isInCombat to false", () => {
            sm.startCombat(0);
            sm.endCombat(1, "combat_ended");
            expect(sm.isInCombat()).toBe(false);
        });
    });

    describe("tick - Approaching transitions", () => {
        const makeContext = (
            overrides: Partial<CombatStateMachineContext>,
        ): CombatStateMachineContext => ({
            tick: 0,
            targetAlive: true,
            targetInRange: false,
            attackSpeedReady: false,
            playerFrozen: false,
            attackReach: 1,
            hasLineOfSight: true,
            ...overrides,
        });

        beforeEach(() => {
            sm.startCombat(0);
        });

        it("stays in Approaching if target not in range", () => {
            const transition = sm.tick(makeContext({ tick: 1, targetInRange: false }));
            expect(transition).toBeNull();
            expect(sm.getState()).toBe(CombatPhase.Approaching);
        });

        it("stays in Approaching if attack not ready", () => {
            const transition = sm.tick(
                makeContext({ tick: 1, targetInRange: true, attackSpeedReady: false }),
            );
            expect(transition).toBeNull();
            expect(sm.getState()).toBe(CombatPhase.Approaching);
        });

        it("transitions to Attacking when in range and attack ready", () => {
            const transition = sm.tick(
                makeContext({ tick: 1, targetInRange: true, attackSpeedReady: true }),
            );
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Attacking);
            expect(sm.getState()).toBe(CombatPhase.Attacking);
        });

        it("transitions to Idle when target dies", () => {
            const transition = sm.tick(makeContext({ tick: 1, targetAlive: false }));
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Idle);
            expect(transition!.reason).toBe("target_dead");
        });

        it("transitions to Frozen when player frozen", () => {
            const transition = sm.tick(makeContext({ tick: 1, playerFrozen: true }));
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Frozen);
            expect(sm.isFrozen()).toBe(true);
        });

        it("stays Approaching for ranged if no line of sight", () => {
            const transition = sm.tick(
                makeContext({
                    tick: 1,
                    targetInRange: true,
                    attackSpeedReady: true,
                    attackReach: 7,
                    hasLineOfSight: false,
                }),
            );
            expect(transition).toBeNull();
            expect(sm.getState()).toBe(CombatPhase.Approaching);
        });
    });

    describe("tick - Attacking transitions", () => {
        const makeContext = (
            overrides: Partial<CombatStateMachineContext>,
        ): CombatStateMachineContext => ({
            tick: 0,
            targetAlive: true,
            targetInRange: true,
            attackSpeedReady: true,
            playerFrozen: false,
            attackReach: 1,
            hasLineOfSight: true,
            ...overrides,
        });

        beforeEach(() => {
            sm.startCombat(0);
            sm.tick(makeContext({ tick: 1 })); // -> Attacking
        });

        it("always transitions to Cooldown from Attacking", () => {
            const transition = sm.tick(makeContext({ tick: 2 }));
            expect(transition).not.toBeNull();
            expect(transition!.from).toBe(CombatPhase.Attacking);
            expect(transition!.to).toBe(CombatPhase.Cooldown);
            expect(transition!.reason).toBe("attack_executed");
        });
    });

    describe("tick - Cooldown transitions", () => {
        const makeContext = (
            overrides: Partial<CombatStateMachineContext>,
        ): CombatStateMachineContext => ({
            tick: 0,
            targetAlive: true,
            targetInRange: true,
            attackSpeedReady: false,
            playerFrozen: false,
            attackReach: 1,
            hasLineOfSight: true,
            ...overrides,
        });

        beforeEach(() => {
            sm.startCombat(0);
            sm.tick(makeContext({ tick: 1, attackSpeedReady: true })); // -> Attacking
            sm.tick(makeContext({ tick: 2 })); // -> Cooldown
        });

        it("stays in Cooldown if attack not ready", () => {
            const transition = sm.tick(makeContext({ tick: 3, attackSpeedReady: false }));
            expect(transition).toBeNull();
            expect(sm.getState()).toBe(CombatPhase.Cooldown);
        });

        it("transitions to Attacking when attack ready and in range", () => {
            const transition = sm.tick(
                makeContext({ tick: 6, attackSpeedReady: true, targetInRange: true }),
            );
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Attacking);
            expect(transition!.reason).toBe("attack_ready");
        });

        it("transitions to Approaching when attack ready but out of range", () => {
            const transition = sm.tick(
                makeContext({ tick: 6, attackSpeedReady: true, targetInRange: false }),
            );
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Approaching);
            expect(transition!.reason).toBe("target_out_of_range");
        });

        it("transitions to Idle when target dies", () => {
            const transition = sm.tick(makeContext({ tick: 3, targetAlive: false }));
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Idle);
        });
    });

    describe("freeze mechanics", () => {
        const makeContext = (
            overrides: Partial<CombatStateMachineContext>,
        ): CombatStateMachineContext => ({
            tick: 0,
            targetAlive: true,
            targetInRange: true,
            attackSpeedReady: true,
            playerFrozen: false,
            attackReach: 1,
            hasLineOfSight: true,
            ...overrides,
        });

        beforeEach(() => {
            sm.startCombat(0);
        });

        it("applyFreeze transitions to Frozen", () => {
            const transition = sm.applyFreeze(1);
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Frozen);
            expect(sm.isFrozen()).toBe(true);
        });

        it("applyFreeze returns null if already frozen", () => {
            sm.applyFreeze(1);
            const secondFreeze = sm.applyFreeze(2);
            expect(secondFreeze).toBeNull();
        });

        it("applyFreeze returns null if in Idle state", () => {
            sm.endCombat(1, "test");
            const transition = sm.applyFreeze(2);
            expect(transition).toBeNull();
        });

        it("removeFreeze returns to previous state", () => {
            sm.applyFreeze(1);
            const transition = sm.removeFreeze(10);
            expect(transition).not.toBeNull();
            expect(transition!.from).toBe(CombatPhase.Frozen);
            expect(transition!.to).toBe(CombatPhase.Approaching);
        });

        it("removeFreeze returns null if not frozen", () => {
            const transition = sm.removeFreeze(1);
            expect(transition).toBeNull();
        });

        it("tick unfreezes when playerFrozen becomes false", () => {
            sm.applyFreeze(1);
            const transition = sm.tick(makeContext({ tick: 10, playerFrozen: false }));
            expect(transition).not.toBeNull();
            expect(transition!.to).toBe(CombatPhase.Approaching);
            expect(transition!.reason).toBe("freeze_expired");
        });

        it("remembers previous state through freeze", () => {
            // Get to Cooldown
            sm.tick(makeContext({ tick: 1 })); // -> Attacking
            sm.tick(makeContext({ tick: 2 })); // -> Cooldown
            expect(sm.getState()).toBe(CombatPhase.Cooldown);

            // Apply freeze
            sm.applyFreeze(3);
            expect(sm.getState()).toBe(CombatPhase.Frozen);

            // Remove freeze - should return to Cooldown
            const transition = sm.removeFreeze(10);
            expect(transition!.to).toBe(CombatPhase.Cooldown);
        });
    });

    describe("transition history", () => {
        it("records all transitions", () => {
            sm.startCombat(0);
            sm.endCombat(1, "canceled");
            const history = sm.getTransitionHistory();
            expect(history.length).toBe(2);
            expect(history[0].to).toBe(CombatPhase.Approaching);
            expect(history[1].to).toBe(CombatPhase.Idle);
        });

        it("limits history size", () => {
            // Create many transitions
            for (let i = 0; i < 100; i++) {
                sm.startCombat(i);
                sm.endCombat(i, "test");
            }
            const history = sm.getTransitionHistory();
            expect(history.length).toBeLessThanOrEqual(50);
        });
    });

    describe("reset", () => {
        it("clears all state", () => {
            sm.startCombat(0);
            sm.applyFreeze(1);
            sm.reset();
            expect(sm.getState()).toBe(CombatPhase.Idle);
            expect(sm.isInCombat()).toBe(false);
            expect(sm.isFrozen()).toBe(false);
            expect(sm.getTransitionHistory().length).toBe(0);
        });
    });

    describe("forceState", () => {
        it("sets state regardless of current state", () => {
            const transition = sm.forceState(CombatPhase.Cooldown, 0, "migration");
            expect(transition.to).toBe(CombatPhase.Cooldown);
            expect(sm.getState()).toBe(CombatPhase.Cooldown);
        });

        it("prefixes reason with force:", () => {
            const transition = sm.forceState(CombatPhase.Attacking, 0, "test");
            expect(transition.reason).toBe("force: test");
        });
    });
});
