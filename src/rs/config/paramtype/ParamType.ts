import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

export class ParamType extends Type {
    private static SCRIPT_VAR_TYPES = [
        "€",
        "\u0000",
        "‚",
        "ƒ",
        "„",
        "…",
        "†",
        "‡",
        "ˆ",
        "‰",
        "Š",
        "‹",
        "Œ",
        "\u0000",
        "Ž",
        "\u0000",
        "\u0000",
        "‘",
        "’",
        "“",
        "”",
        "•",
        "–",
        "—",
        "˜",
        "™",
        "š",
        "›",
        "œ",
        "\u0000",
        "ž",
        "Ÿ",
    ];

    // ScriptVarType
    type!: string;

    defaultInt: number = 0;

    defaultLong: bigint = 0n;

    defaultString!: string;

    autoDisable: boolean = true;

    private static SCRIPT_VAR_TYPE_BY_ID: Map<number, string> = new Map([
        [0, "i"], [1, "1"], [6, "A"], [7, "C"], [8, "H"], [9, "I"],
        [10, "K"], [11, "M"], [13, "O"], [14, "P"], [17, "S"], [22, "c"],
        [23, "d"], [25, "f"], [26, "g"], [28, "j"], [30, "l"], [31, "m"],
        [32, "n"], [33, "o"], [36, "s"], [37, "t"], [39, "v"], [40, "x"],
        [41, "y"], [42, "z"], [55, "\u00a3"], [59, "\u00b5"], [62, "\u00d7"],
        [73, "J"], [74, "\u00d0"], [118, "\u00d8"], [209, "7"],
    ]);

    static getCharForTypeId(id: number): string {
        return ParamType.SCRIPT_VAR_TYPE_BY_ID.get(id) ?? "i";
    }

    static getJagexChar(c: number): string {
        if (c === 0) {
            throw new Error("Invalid char: " + c);
        } else {
            if (c >= 128 && c < 160) {
                let s = ParamType.SCRIPT_VAR_TYPES[c - 128];
                if (s === "\u0000") {
                    s = "?";
                }

                return s;
            }

            return String.fromCharCode(c);
        }
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.type = ParamType.getJagexChar(buffer.readUnsignedByte());
        } else if (opcode === 2) {
            this.defaultInt = buffer.readInt();
        } else if (opcode === 4) {
            this.autoDisable = false;
        } else if (opcode === 5) {
            this.defaultString = buffer.readString();
        } else if (opcode === 7) {
            const high = buffer.readInt();
            const low = buffer.readInt();
            this.defaultLong = (BigInt(high) << 32n) | BigInt(low >>> 0);
        } else if (opcode === 8) {
            this.type = ParamType.getCharForTypeId(buffer.readUnsignedByte());
        }
    }

    isString(): boolean {
        return this.type === "s";
    }
}
