import { PlayerAnimController } from "./PlayerAnimController";

type SeqDef = {
    totalFrames?: number;
    frameLen?: number;
    frameStep?: number;
    maxLoops?: number;
    replyMode?: number;
    forcedPriority?: number;
    priority?: number;
    isSkeletal?: boolean;
    skeletalDuration?: number;
};

const makeSeqTypeLoader = (defs: Record<number, SeqDef>) => ({
    load: (id: number) => {
        const def = defs[id];
        if (!def) return undefined;
        const totalFrames = Math.max(1, (def.totalFrames ?? 1) | 0);
        const frameLen = Math.max(1, (def.frameLen ?? 1) | 0);
        const frameStep = (def.frameStep ?? totalFrames) | 0;
        const maxLoops = (def.maxLoops ?? 99) | 0;
        const replyMode = (def.replyMode ?? 2) | 0;
        const forcedPriority = (def.forcedPriority ?? 5) | 0;
        const priority = (def.priority ?? -1) | 0;
        const isSkeletal = !!def.isSkeletal;
        const skeletalDuration = Math.max(1, (def.skeletalDuration ?? 1) | 0);

        return {
            frameIds: new Array(totalFrames).fill(0),
            frameStep,
            maxLoops,
            replyMode,
            forcedPriority,
            priority,
            isSkeletalSeq: () => isSkeletal,
            getSkeletalDuration: () => skeletalDuration,
            getFrameLength: (_loader: any, _frame: number) => frameLen,
        };
    },
});

const seqFrameLoader = {} as any;

const makePlayerEcsStub = (
    serverIds: number | number[],
    overrides: Partial<{
        setAnimSeqId: any;
        setAnimSeqDelay: any;
        setAnimLoopCounter: any;
    }> = {},
) => {
    const ids = Array.isArray(serverIds) ? serverIds.slice() : [serverIds];
    return {
        getAllServerIds: function* () {
            for (const id of ids) yield id;
        },
        getIndexForServerId: (sid: number) => (ids.includes(sid | 0) ? 0 : undefined),
        getAnimMovementSeqId: () => -1,
        setAnimSeqId: overrides.setAnimSeqId ?? jest.fn(),
        setAnimSeqDelay: overrides.setAnimSeqDelay ?? jest.fn(),
        setAnimLoopCounter: overrides.setAnimLoopCounter ?? jest.fn(),
    } as any;
};

describe("PlayerAnimController (OSRS parity)", () => {
    test("steps frames using frame lengths and clears when maxLoops reached", () => {
        const seqId = 123;
        const ctrl = new PlayerAnimController(
            makePlayerEcsStub(42),
            makeSeqTypeLoader({
                [seqId]: { totalFrames: 3, frameLen: 5, frameStep: 3, maxLoops: 1 },
            }) as any,
            seqFrameLoader,
        );

        ctrl.handleServerSequence(42, seqId, { delay: 0 });

        // After 15 ticks (sum of frame lengths), still on the last frame.
        ctrl.tick(15);
        const state15 = ctrl.getSequenceState(42)!;
        expect(state15.seqId).toBe(seqId);
        expect(state15.frame).toBe(2);
        expect(state15.frameCycle).toBe(5);

        // Next tick crosses end-of-sequence, increments loop counter and clears (maxLoops=1).
        ctrl.tick(1);
        expect(ctrl.getSequenceState(42)).toBeUndefined();
    });

    test("restartMode==1 fully restarts same sequence and sets delay", () => {
        const seqId = 200;
        const ctrl = new PlayerAnimController(
            makePlayerEcsStub(1),
            makeSeqTypeLoader({
                [seqId]: { totalFrames: 2, frameLen: 1, frameStep: 2, maxLoops: 99, replyMode: 1 },
            }) as any,
            seqFrameLoader,
        );

        ctrl.handleServerSequence(1, seqId, { delay: 0 });
        ctrl.tick(2);
        expect(ctrl.getSequenceState(1)?.frame).toBe(1);

        ctrl.handleServerSequence(1, seqId, { delay: 3 });
        const restarted = ctrl.getSequenceState(1)!;
        expect(restarted.seqId).toBe(seqId);
        expect(restarted.frame).toBe(0);
        expect(restarted.frameCycle).toBe(0);
        expect(restarted.delay).toBe(3);
        expect(restarted.loopCounter).toBe(0);
    });

    test("forcedPriority gates replacement sequences", () => {
        const high = 300;
        const low = 301;
        const setAnimSeqId = jest.fn();
        const ctrl = new PlayerAnimController(
            makePlayerEcsStub(2, { setAnimSeqId }),
            makeSeqTypeLoader({
                [high]: { totalFrames: 1, frameLen: 1, forcedPriority: 5 },
                [low]: { totalFrames: 1, frameLen: 1, forcedPriority: 4 },
            }) as any,
            seqFrameLoader,
        );

        ctrl.handleServerSequence(2, high, { delay: 0 });
        expect(ctrl.getSequenceState(2)?.seqId).toBe(high);

        // Lower priority sequence should be ignored (no state change).
        ctrl.handleServerSequence(2, low, { delay: 0 });
        expect(ctrl.getSequenceState(2)?.seqId).toBe(high);

        // Only one actual seq assignment (the first one).
        expect(setAnimSeqId).toHaveBeenCalledTimes(1);
    });

    test("cancelSequenceOnMove clears only when priority==1", () => {
        const cancels = 400;
        const stays = 401;
        const ctrl = new PlayerAnimController(
            makePlayerEcsStub(9),
            makeSeqTypeLoader({
                [cancels]: { totalFrames: 1, frameLen: 1, priority: 1 },
                [stays]: { totalFrames: 1, frameLen: 1, priority: 0 },
            }) as any,
            seqFrameLoader,
        );

        ctrl.handleServerSequence(9, stays, { delay: 0 });
        ctrl.cancelSequenceOnMove(9);
        expect(ctrl.getSequenceState(9)?.seqId).toBe(stays);

        ctrl.handleServerSequence(9, cancels, { delay: 0 });
        ctrl.cancelSequenceOnMove(9);
        expect(ctrl.getSequenceState(9)).toBeUndefined();
    });
});
