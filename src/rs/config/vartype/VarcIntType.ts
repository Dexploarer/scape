import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

export class VarcIntType extends Type {
    persist: boolean = false;

    override decodeOpcode(opcode: number, _buffer: ByteBuffer): void {
        if (opcode === 2) {
            this.persist = true;
        }
    }
}
