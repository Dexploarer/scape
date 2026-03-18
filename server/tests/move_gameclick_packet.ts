import assert from "assert";

import { ClientPacketId } from "../../src/network/packet/ClientPacket";
import { PacketBuffer } from "../../src/network/packet/PacketBuffer";
import { decodePacket } from "../src/network/packet/PacketHandler";

function main() {
    // Mirror references/runescape-client class31.java ground click write order for field3179:
    // - writeShortAddLE(worldY)
    // - writeByteNeg(modifierFlags) where 0=none, 1=ctrl, 2=ctrl+shift
    // - writeShortAddLE(worldX)
    // - writeShortAdd(0) (unused param; we keep it for length/parity)
    const worldX = 3200;
    const worldY = 3201;
    const modifierFlags = 2; // ctrl + shift
    const locId = 0;

    const buf = new PacketBuffer(7);
    buf.writeShortAddLE(worldY);
    buf.writeByteNeg(modifierFlags);
    buf.writeShortAddLE(worldX);
    buf.writeShortAdd(locId);

    const decoded = decodePacket(ClientPacketId.MOVE_GAMECLICK, buf.toArray());
    assert.strictEqual(decoded.type, "move");
    assert.strictEqual((decoded as any).worldX, worldX);
    assert.strictEqual((decoded as any).worldY, worldY);
    assert.strictEqual((decoded as any).modifierFlags, modifierFlags);
    assert.strictEqual((decoded as any).locId, locId);

    // eslint-disable-next-line no-console
    console.log("MOVE_GAMECLICK packet parity test passed.");
}

main();
