import type { ByteBuffer } from "../../io/ByteBuffer";
import type { DbColumnValueSet } from "./DbRow";
import { DbRow } from "./DbRow";
import { ScriptVarTypeId, decodeScriptVarValue } from "./ScriptVarType";

function decodeColumnFields(buffer: ByteBuffer, types: ScriptVarTypeId[]): any[] {
    const fieldCount = buffer.readUnsignedShortSmart();
    const out: any[] = new Array(fieldCount * types.length);
    for (let field = 0; field < fieldCount; field++) {
        for (let i = 0; i < types.length; i++) {
            const idx = field * types.length + i;
            out[idx] = decodeScriptVarValue(types[i], buffer);
        }
    }
    return out;
}

export function loadDbRow(id: number, buffer: ByteBuffer): DbRow {
    const row = new DbRow(id);
    while (buffer.remaining > 0) {
        const opcode = buffer.readUnsignedByte();
        if (opcode === 0) {
            break;
        }
        switch (opcode) {
            case 3: {
                buffer.readUnsignedByte(); // number of columns (unused)
                for (
                    let columnId = buffer.readUnsignedByte();
                    columnId !== 255;
                    columnId = buffer.readUnsignedByte()
                ) {
                    const typeCount = buffer.readUnsignedByte();
                    const types: ScriptVarTypeId[] = new Array(typeCount);
                    for (let i = 0; i < typeCount; i++) {
                        types[i] = buffer.readUnsignedShortSmart() as ScriptVarTypeId;
                    }
                    const values = decodeColumnFields(buffer, types);
                    const valueSet: DbColumnValueSet = {
                        columnId,
                        types,
                        values,
                    };
                    row.setColumn(valueSet);
                }
                break;
            }
            case 4: {
                row.tableId = buffer.readVarInt2();
                break;
            }
            default:
                // Unsupported opcode – stop parsing to avoid misalignment
                buffer.offset = buffer.length;
                break;
        }
    }
    return row;
}
