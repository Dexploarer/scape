import assert from "assert";

import { WSServer } from "../src/network/wsServer";

const READY_STATE_OPEN = 1;

function createHarness(): any {
    const server: any = Object.create(WSServer.prototype);
    server.directSendBypassDepth = 0;
    server.directSendWarningContexts = new Set<string>();
    server.isBroadcastPhase = false;
    return server;
}

function createSocket() {
    return {
        readyState: READY_STATE_OPEN,
        sent: [] as string[],
        send(this: any, message: string) {
            this.sent.push(message);
        },
    };
}

function testGuardFlagsOutsideBroadcast() {
    const server = createHarness();
    const sock = createSocket();
    server.sendWithGuard(sock, "ping", "outside");
    assert.deepStrictEqual(sock.sent, ["ping"]);
    assert.ok(
        server.directSendWarningContexts.has("outside"),
        "guard should record context when bypass not active",
    );
}

function testBypassAllowsImmediateSend() {
    const server = createHarness();
    const sock = createSocket();
    server.withDirectSendBypass("bypass", () => {
        server.sendWithGuard(sock, "hello", "inside");
    });
    assert.deepStrictEqual(sock.sent, ["hello"]);
    assert.strictEqual(
        server.directSendWarningContexts.size,
        0,
        "bypass should suppress guard warnings",
    );
}

function testBroadcastPhaseAllowsSend() {
    const server = createHarness();
    const sock = createSocket();
    server.isBroadcastPhase = true;
    server.sendWithGuard(sock, "tick", "broadcast");
    server.isBroadcastPhase = false;
    assert.strictEqual(
        server.directSendWarningContexts.size,
        0,
        "broadcast phase should allow direct sends",
    );
}

function testFlushThrowsInStrictMode() {
    const server = createHarness();
    const sock = createSocket();
    const prevStrict = process.env.DIRECT_SEND_GUARD_STRICT;
    process.env.DIRECT_SEND_GUARD_STRICT = "1";
    try {
        server.sendWithGuard(sock, "warn", "strict");
        assert.throws(
            () => server.flushDirectSendWarnings("unit-test"),
            (err: unknown) =>
                err instanceof Error &&
                err.message.includes("unit-test") &&
                err.message.includes("strict"),
            "flush should throw with context details in strict mode",
        );
        assert.strictEqual(
            server.directSendWarningContexts.size,
            0,
            "flush must clear tracked contexts after assertion",
        );
    } finally {
        if (prevStrict === undefined) {
            delete process.env.DIRECT_SEND_GUARD_STRICT;
        } else {
            process.env.DIRECT_SEND_GUARD_STRICT = prevStrict;
        }
    }
}

function testFlushNoWarningsIsNoop() {
    const server = createHarness();
    const prevStrict = process.env.DIRECT_SEND_GUARD_STRICT;
    process.env.DIRECT_SEND_GUARD_STRICT = "1";
    try {
        server.flushDirectSendWarnings("noop");
    } finally {
        if (prevStrict === undefined) {
            delete process.env.DIRECT_SEND_GUARD_STRICT;
        } else {
            process.env.DIRECT_SEND_GUARD_STRICT = prevStrict;
        }
    }
}

function main() {
    testGuardFlagsOutsideBroadcast();
    testBypassAllowsImmediateSend();
    testBroadcastPhaseAllowsSend();
    testFlushThrowsInStrictMode();
    testFlushNoWarningsIsNoop();
    // eslint-disable-next-line no-console
    console.log("Direct send guard tests passed.");
}

main();
