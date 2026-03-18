import assert from "assert";

import { PacketBuffer } from "../../src/network/packet/PacketBuffer";
import { ServerPacketBuffer } from "../src/network/packet/ServerPacketBuffer";

function testIntMeRoundTrip(): void {
    const value = 0x00da0009;
    const client = new PacketBuffer(4);
    client.writeIntME(value);

    const server = new ServerPacketBuffer(client.toArray());
    assert.strictEqual(server.readIntME(), value);
}

function testIntImeRoundTrip(): void {
    const value = 0x00da0009;
    const client = new PacketBuffer(4);
    client.writeIntIME(value);

    const server = new ServerPacketBuffer(client.toArray());
    assert.strictEqual(server.readIntIME(), value);
}

testIntMeRoundTrip();
testIntImeRoundTrip();

console.log("Packet int endian roundtrip test passed.");
