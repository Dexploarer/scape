import type { ByteBuffer } from "../../io/ByteBuffer";
import type { DbColumnDefinition } from "./DbTableDefinition";
import { DbTableDefinition } from "./DbTableDefinition";
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

export function loadDbTable(id: number, buffer: ByteBuffer): DbTableDefinition {
    const def = new DbTableDefinition(id);
    while (buffer.remaining > 0) {
        const opcode = buffer.readUnsignedByte();
        if (opcode === 0) {
            break;
        }
        if (opcode === 1) {
            // Column definitions
            buffer.readUnsignedByte(); // number of columns (unused directly)
            for (
                let setting = buffer.readUnsignedByte();
                setting !== 255;
                setting = buffer.readUnsignedByte()
            ) {
                const columnId = setting & 0x7f;
                const hasDefault = (setting & 0x80) !== 0;
                const typeCount = buffer.readUnsignedByte();
                const types: ScriptVarTypeId[] = new Array(typeCount);
                for (let i = 0; i < typeCount; i++) {
                    types[i] = buffer.readUnsignedShortSmart() as ScriptVarTypeId;
                }
                const columnDef: DbColumnDefinition = {
                    columnId,
                    types,
                };
                if (hasDefault) {
                    columnDef.defaultValues = decodeColumnFields(buffer, types);
                }
                def.setColumn(columnDef);
            }
        } else {
            // Unknown opcode, bail out
            break;
        }
    }
    return def;
}

export { decodeColumnFields };
