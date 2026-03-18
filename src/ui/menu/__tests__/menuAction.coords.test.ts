import { ClientState } from "../../../client/ClientState";
import { queuePacket } from "../../../network/packet";
import { PacketBuffer } from "../../../network/packet/PacketBuffer";
import { menuAction, setNpcExamineIdResolver } from "../MenuAction";
import { MenuOpcode } from "../MenuState";

jest.mock("../../../network/packet", () => {
    const actual = jest.requireActual("../../../network/packet");
    return {
        ...actual,
        queuePacket: jest.fn(),
    };
});

type QueuedNode = {
    packetType: number;
    packetBuffer: { toArray: () => Uint8Array };
};

function lastQueued(): QueuedNode {
    const calls = (queuePacket as unknown as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0] as QueuedNode;
}

function payloadBuffer(node: QueuedNode): PacketBuffer {
    const bytes = node.packetBuffer.toArray();
    // Skip opcode byte at index 0.
    const pb = new PacketBuffer(bytes);
    pb.offset = 1;
    return pb;
}

describe("menuAction coord packing (local->world)", () => {
    beforeEach(() => {
        (queuePacket as unknown as jest.Mock).mockClear();
        setNpcExamineIdResolver(null);
        ClientState.reset();
        ClientState.baseX = 3200;
        ClientState.baseY = 3200;
        ClientState.setKeybindState(82, false); // Ctrl
        ClientState.selectedItemWidget = 0x11223344;
        ClientState.selectedItemSlot = 7;
        ClientState.selectedItemId = 4151;
        ClientState.selectedSpellWidget = 0x55667788;
        ClientState.selectedSpellChildIndex = 3;
        ClientState.selectedSpellItemId = 21880;
    });

    test("OPLOC1 world coords are base+local (tile units)", () => {
        const localX = 5;
        const localY = 7;
        menuAction(
            localX,
            localY,
            MenuOpcode.GameObjectFirstOption,
            1234,
            -1,
            "Open",
            "",
            100,
            100,
        );
        const node = lastQueued();
        const pb = payloadBuffer(node);
        const worldY = pb.readUnsignedShortAddLE();
        pb.readByteNeg(); // ctrl
        const worldX = pb.readUnsignedShortAddLE();
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("OPOBJ1 world coords are base+local (tile units)", () => {
        const localX = 11;
        const localY = 13;
        menuAction(localX, localY, MenuOpcode.GroundItemFirstOption, 995, -1, "Take", "", 100, 100);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        pb.readByteSub(); // ctrl
        const worldY = pb.readUnsignedShortLE();
        pb.readUnsignedShortAddLE(); // identifier (writeShortAdd)
        const worldX = pb.readUnsignedShortAddLE(); // writeShortAdd
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("WALKHERE (MOVE_GAMECLICK) world coords are base+local (tile units)", () => {
        const localX = 20;
        const localY = 21;
        menuAction(localX, localY, MenuOpcode.WalkHere, 0, -1, "Walk here", "", 50, 50);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        const worldY = pb.readUnsignedShortAddLE();
        pb.readByteNeg(); // ctrl
        const worldX = pb.readUnsignedShortAddLE();
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("WALKHERE writes modifierFlags=2 for ctrl+shift", () => {
        ClientState.setKeybindState(82, true); // Ctrl
        ClientState.setKeybindState(81, true); // Shift
        menuAction(20, 21, MenuOpcode.WalkHere, 0, -1, "Walk here", "", 50, 50);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        pb.readUnsignedShortAddLE(); // worldY
        expect(pb.readUnsignedByteNeg()).toBe(2);
    });

    test("OPLOCU world coords are base+local (tile units)", () => {
        const localX = 31;
        const localY = 32;
        menuAction(localX, localY, MenuOpcode.ItemUseOnGameObject, 100, -1, "Use", "", 1, 1);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        pb.readUnsignedShortAddLE(); // selectedItemSlot (writeShortAddLE)
        pb.readUnsignedShortAddLE(); // identifier (writeShortAdd)
        pb.readUnsignedIntLE(); // selectedItemWidget (writeIntLE)
        pb.readByteSub(); // ctrl
        const worldX = pb.readUnsignedShortLE();
        const worldY = pb.readUnsignedShort();
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("OPLOCT world coords are base+local (tile units)", () => {
        const localX = 40;
        const localY = 41;
        menuAction(localX, localY, MenuOpcode.WidgetTargetOnGameObject, 101, -1, "Cast", "", 1, 1);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        const worldY = pb.readUnsignedShortAddLE(); // writeShortAddLE(worldY)
        pb.readUnsignedShortAddLE(); // identifier (writeShortAdd)
        pb.readUnsignedShortAddLE(); // selectedSpellChildIndex (writeShortAdd)
        pb.readUnsignedIntLE(); // selectedSpellWidget
        const worldX = pb.readUnsignedShort(); // writeShort(worldX)
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("OPOBJU world coords are base+local (tile units)", () => {
        const localX = 50;
        const localY = 51;
        menuAction(localX, localY, MenuOpcode.ItemUseOnGroundItem, 200, -1, "Use", "", 1, 1);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        pb.readUnsignedShortAddLE(); // identifier (writeShortAddLE)
        const worldY = pb.readUnsignedShortAddLE(); // writeShortAdd(worldY)
        pb.readUnsignedIntME(); // selectedItemWidget
        const worldX = pb.readUnsignedShortAddLE(); // writeShortAdd(worldX)
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("OPOBJT world coords are base+local (tile units)", () => {
        const localX = 60;
        const localY = 61;
        menuAction(localX, localY, MenuOpcode.WidgetTargetOnGroundItem, 201, -1, "Cast", "", 1, 1);
        const node = lastQueued();
        const pb = payloadBuffer(node);
        pb.readUnsignedIntLE(); // selectedSpellWidget
        pb.readUnsignedShortAddLE(); // selectedSpellChildIndex (writeShortAdd)
        pb.readUnsignedShortAddLE(); // identifier (writeShortAdd)
        const worldX = pb.readUnsignedShortAdd(); // writeShortAddLE(worldX)
        const worldY = pb.readUnsignedShort(); // writeShort(worldY)
        expect(worldX).toBe((ClientState.baseX | 0) + localX);
        expect(worldY).toBe((ClientState.baseY | 0) + localY);
    });

    test("OPPLAYER attack/follow/trade payloads match deob field order", () => {
        ClientState.players[321] = {} as any;
        ClientState.players[322] = {} as any;
        ClientState.players[323] = {} as any;

        menuAction(10, 11, MenuOpcode.PlayerFirstOption, 321, -1, "Attack", "", 50, 50);
        let pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedByteSub()).toBe(0);
        expect(pb.readUnsignedShort()).toBe(321);

        menuAction(10, 11, MenuOpcode.PlayerSecondOption, 322, -1, "Trade with", "", 50, 50);
        pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedByte()).toBe(0);
        expect(pb.readUnsignedShort()).toBe(322);

        menuAction(10, 11, MenuOpcode.PlayerThirdOption, 323, -1, "Follow", "", 50, 50);
        pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedByteSub()).toBe(0);
        expect(pb.readUnsignedShort()).toBe(323);
    });

    test("OPPLAYER4-8 payloads match deob field order", () => {
        ClientState.players[401] = {} as any;
        ClientState.players[402] = {} as any;
        ClientState.players[403] = {} as any;
        ClientState.players[404] = {} as any;
        ClientState.players[405] = {} as any;

        menuAction(10, 11, MenuOpcode.PlayerFourthOption, 401, -1, "Option4", "", 50, 50);
        let pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShort()).toBe(401);
        expect(pb.readUnsignedByteNeg()).toBe(0);

        menuAction(10, 11, MenuOpcode.PlayerFifthOption, 402, -1, "Option5", "", 50, 50);
        pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShortAddLE()).toBe(402);
        expect(pb.readUnsignedByteSub()).toBe(0);

        menuAction(10, 11, MenuOpcode.PlayerSixthOption, 403, -1, "Option6", "", 50, 50);
        pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShort()).toBe(403);
        expect(pb.readUnsignedByteNeg()).toBe(0);

        menuAction(10, 11, MenuOpcode.PlayerSeventhOption, 404, -1, "Option7", "", 50, 50);
        pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShortAdd()).toBe(404);
        expect(pb.readUnsignedByteSub()).toBe(0);

        menuAction(10, 11, MenuOpcode.PlayerEighthOption, 405, -1, "Option8", "", 50, 50);
        pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedByte()).toBe(0);
        expect(pb.readUnsignedShortAdd()).toBe(405);
    });

    test("EXAMINE_LOC writes ShortAddLE loc id", () => {
        menuAction(0, 0, MenuOpcode.ExamineObject, 1337, -1, "Examine", "", 50, 50);
        const pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShortAdd()).toBe(1337);
    });

    test("EXAMINE_NPC writes transformed npc type id", () => {
        ClientState.npcs[77] = { index: 77 } as any;
        setNpcExamineIdResolver((serverId) => (serverId === 77 ? 7413 : undefined));

        menuAction(0, 0, MenuOpcode.ExamineNpc, 77, -1, "Examine", "", 50, 50);
        const pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShortAddLE()).toBe(7413);
    });

    test("EXAMINE_NPC does not require a populated ClientState npc slot", () => {
        setNpcExamineIdResolver((serverId) => (serverId === 88 ? 9021 : undefined));

        menuAction(0, 0, MenuOpcode.ExamineNpc, 88, -1, "Examine", "", 50, 50);
        const pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShortAddLE()).toBe(9021);
    });

    test("EXAMINE_OBJ writes item id plus world coordinates", () => {
        const localX = 14;
        const localY = 15;
        menuAction(localX, localY, MenuOpcode.ExamineGroundItem, 995, -1, "Examine", "", 50, 50);
        const pb = payloadBuffer(lastQueued());
        expect(pb.readUnsignedShort()).toBe(995);
        expect(pb.readUnsignedShortLE()).toBe((ClientState.baseY | 0) + localY);
        expect(pb.readUnsignedShortLE()).toBe((ClientState.baseX | 0) + localX);
    });
});
