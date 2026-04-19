import { describe, expect, test } from "bun:test";

import { decodeClientPacket } from "../server/src/network/packet/ClientBinaryDecoder";
import { encodeClientMessage } from "../src/network/packet/ClientBinaryEncoder";

describe("hosted login packet transport", () => {
    test("preserves legacy username/password login payloads", () => {
        const encoded = encodeClientMessage({
            type: "login",
            payload: {
                username: "alice",
                password: "hunter2",
                revision: 232,
            },
        });

        expect(decodeClientPacket(encoded)).toEqual({
            type: "login",
            payload: {
                username: "alice",
                password: "hunter2",
                revision: 232,
                sessionToken: undefined,
                worldCharacterId: undefined,
            },
        });
    });

    test("round-trips hosted session login payloads additively", () => {
        const encoded = encodeClientMessage({
            type: "login",
            payload: {
                revision: 232,
                sessionToken: "hs1.payload.signature",
                worldCharacterId: "char-77",
            },
        });

        expect(decodeClientPacket(encoded)).toEqual({
            type: "login",
            payload: {
                username: "",
                password: "",
                revision: 232,
                sessionToken: "hs1.payload.signature",
                worldCharacterId: "char-77",
            },
        });
    });
});
