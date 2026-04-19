import { describe, expect, test } from "bun:test";

import { decodeClientPacket } from "../server/src/network/packet/ClientBinaryDecoder";
import { encodeClientMessage } from "../src/network/packet/ClientBinaryEncoder";

describe("debug packet transport", () => {
    test("round-trips ground item actions with opNum and modifier flags", () => {
        const encoded = encodeClientMessage({
            type: "ground_item_action",
            payload: {
                stackId: 321,
                tile: { x: 12, y: 34, level: 2 },
                itemId: 995,
                quantity: 1500,
                option: "take",
                opNum: 3,
                modifierFlags: 2,
            },
        });

        expect(decodeClientPacket(encoded)).toEqual({
            type: "ground_item_action",
            payload: {
                stackId: 321,
                tile: { x: 12, y: 34, level: 2 },
                itemId: 995,
                quantity: 1500,
                option: "take",
                opNum: 3,
                modifierFlags: 2,
            },
        });
    });

    test("round-trips bot sdk script control payloads", () => {
        const encoded = encodeClientMessage({
            type: "debug",
            payload: {
                kind: "bot_sdk_script",
                operation: "install",
                script: {
                    schemaVersion: 1,
                    scriptId: "xp-watch",
                    steps: [{ id: "wait", kind: "wait", events: ["skill:xpGain"] }],
                },
                targetPlayerId: 88,
            },
        });

        expect(decodeClientPacket(encoded)).toEqual({
            type: "debug",
            payload: {
                kind: "bot_sdk_script",
                operation: "install",
                script: {
                    schemaVersion: 1,
                    scriptId: "xp-watch",
                    steps: [{ id: "wait", kind: "wait", events: ["skill:xpGain"] }],
                },
                targetAgentId: undefined,
                targetPlayerId: 88,
            },
        });
    });

    test("round-trips bot sdk proposal snapshot requests and decisions", () => {
        const request = encodeClientMessage({
            type: "debug",
            payload: {
                kind: "bot_sdk_script_proposals_request",
                targetPlayerId: 77,
            },
        });
        expect(decodeClientPacket(request)).toEqual({
            type: "debug",
            payload: {
                kind: "bot_sdk_script_proposals_request",
                targetPlayerId: 77,
            },
        });

        const decision = encodeClientMessage({
            type: "debug",
            payload: {
                kind: "bot_sdk_script_proposal_decision",
                proposalId: "proposal-1",
                decision: "approve_install",
                reason: "operator ok",
            },
        });
        expect(decodeClientPacket(decision)).toEqual({
            type: "debug",
            payload: {
                kind: "bot_sdk_script_proposal_decision",
                proposalId: "proposal-1",
                decision: "approve_install",
                reason: "operator ok",
            },
        });
    });
});
