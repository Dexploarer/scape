import { ClientPacket, type PacketBufferNode, createPacket } from "../network/packet";
import type { NormalizedSelectedSpellPayload } from "../shared/spells/selectedSpellPayload";

type SelectedSpellPacketSelection = Pick<
    NormalizedSelectedSpellPayload,
    "selectedSpellWidgetId" | "selectedSpellChildIndex" | "selectedSpellItemId"
>;

export function createSelectedSpellOnNpcPacket(
    npcId: number,
    selection: SelectedSpellPacketSelection,
    ctrlHeld: boolean,
): PacketBufferNode {
    const pkt = createPacket(ClientPacket.OPNPCT);
    pkt.packetBuffer.writeShort(npcId | 0);
    pkt.packetBuffer.writeIntLE(selection.selectedSpellWidgetId | 0);
    pkt.packetBuffer.writeShort(selection.selectedSpellChildIndex | 0);
    pkt.packetBuffer.writeShortAdd(selection.selectedSpellItemId | 0);
    pkt.packetBuffer.writeByteAdd(ctrlHeld ? 1 : 0);
    return pkt;
}

export function createSelectedSpellOnPlayerPacket(
    playerId: number,
    selection: SelectedSpellPacketSelection,
    ctrlHeld: boolean,
): PacketBufferNode {
    const pkt = createPacket(ClientPacket.OPPLAYERT);
    pkt.packetBuffer.writeByteNeg(ctrlHeld ? 1 : 0);
    pkt.packetBuffer.writeShortLE(selection.selectedSpellItemId | 0);
    pkt.packetBuffer.writeShortLE(selection.selectedSpellChildIndex | 0);
    pkt.packetBuffer.writeIntIME(selection.selectedSpellWidgetId | 0);
    pkt.packetBuffer.writeShortLE(playerId | 0);
    return pkt;
}

export function createSelectedSpellOnLocPacket(
    locId: number,
    worldX: number,
    worldY: number,
    selection: SelectedSpellPacketSelection,
    ctrlHeld: boolean,
): PacketBufferNode {
    const pkt = createPacket(ClientPacket.OPLOCT);
    pkt.packetBuffer.writeShortAddLE(worldY | 0);
    pkt.packetBuffer.writeShortAdd(locId | 0);
    pkt.packetBuffer.writeShortAdd(selection.selectedSpellChildIndex | 0);
    pkt.packetBuffer.writeIntLE(selection.selectedSpellWidgetId | 0);
    pkt.packetBuffer.writeShort(worldX | 0);
    pkt.packetBuffer.writeShortLE(selection.selectedSpellItemId | 0);
    pkt.packetBuffer.writeByteNeg(ctrlHeld ? 1 : 0);
    return pkt;
}

export function createSelectedSpellOnGroundItemPacket(
    itemId: number,
    worldX: number,
    worldY: number,
    selection: SelectedSpellPacketSelection,
    ctrlHeld: boolean,
): PacketBufferNode {
    const pkt = createPacket(ClientPacket.OPOBJT);
    pkt.packetBuffer.writeIntLE(selection.selectedSpellWidgetId | 0);
    pkt.packetBuffer.writeShortAdd(selection.selectedSpellChildIndex | 0);
    pkt.packetBuffer.writeShortAdd(itemId | 0);
    pkt.packetBuffer.writeShortAddLE(worldX | 0);
    pkt.packetBuffer.writeShort(worldY | 0);
    pkt.packetBuffer.writeByte(ctrlHeld ? 1 : 0);
    pkt.packetBuffer.writeShortAddLE(selection.selectedSpellItemId | 0);
    return pkt;
}

export function createSelectedSpellOnWidgetPacket(
    targetWidgetId: number,
    targetSlot: number,
    targetItemId: number,
    selection: SelectedSpellPacketSelection,
): PacketBufferNode {
    const pkt = createPacket(ClientPacket.IF_BUTTONT);
    pkt.packetBuffer.writeIntIME(targetWidgetId | 0);
    pkt.packetBuffer.writeShortAddLE(targetSlot | 0);
    pkt.packetBuffer.writeIntLE(selection.selectedSpellWidgetId | 0);
    pkt.packetBuffer.writeShortLE(selection.selectedSpellChildIndex | 0);
    pkt.packetBuffer.writeShort(selection.selectedSpellItemId | 0);
    pkt.packetBuffer.writeShortAddLE(targetItemId | 0);
    return pkt;
}
