/**
 * BinaryBridge - Helper functions for binary protocol detection
 *
 * The conversion functions have been moved to PacketHandler.ts as parsePacketsAsMessages()
 * which decodes OSRS packets directly to ClientToServer messages.
 */

/**
 * Check if data is binary packet data vs JSON string
 *
 * The ws library returns all messages as Buffer, so we need to check
 * the content. JSON messages start with '{' (0x7B = 123) or '[' (0x5B = 91).
 * Binary packets start with an opcode which we control and won't be these values.
 */
export function isBinaryData(raw: unknown): raw is Buffer | ArrayBuffer {
    // Not a buffer/arraybuffer at all
    if (!(raw instanceof ArrayBuffer) && !Buffer.isBuffer(raw)) {
        return false;
    }

    // Check first byte to distinguish JSON from binary packets
    let firstByte: number;
    if (raw instanceof ArrayBuffer) {
        if (raw.byteLength === 0) return false;
        firstByte = new Uint8Array(raw)[0];
    } else {
        if (raw.length === 0) return false;
        firstByte = raw[0];
    }

    // JSON starts with '{' (123) or '[' (91) or whitespace
    // Our binary opcodes are carefully chosen to not conflict
    const isJsonStart =
        firstByte === 123 ||
        firstByte === 91 ||
        firstByte === 32 ||
        firstByte === 9 ||
        firstByte === 10 ||
        firstByte === 13;

    return !isJsonStart;
}

/**
 * Convert raw data to Uint8Array
 */
export function toUint8Array(raw: Buffer | ArrayBuffer): Uint8Array {
    if (raw instanceof ArrayBuffer) {
        return new Uint8Array(raw);
    }
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

/**
 * Check if a binary packet uses the new JSON-replacement protocol (opcodes >= 180)
 * vs OSRS-style packets (opcodes 1-103)
 */
export function isNewProtocolPacket(raw: Buffer | ArrayBuffer): boolean {
    let firstByte: number;
    if (raw instanceof ArrayBuffer) {
        if (raw.byteLength === 0) return false;
        firstByte = new Uint8Array(raw)[0];
    } else {
        if (raw.length === 0) return false;
        firstByte = raw[0];
    }
    // New protocol uses opcodes >= 180
    return firstByte >= 180;
}
