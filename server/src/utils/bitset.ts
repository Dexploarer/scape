export function bitsetByteLength(bitCount: number): number {
    const n = Math.max(0, Math.trunc(bitCount));
    return (n + 7) >> 3;
}

export function bitsetGet(bitset: Uint8Array, bitIndex: number): boolean {
    const idx = Math.trunc(bitIndex);
    if (idx < 0) return false;
    const byteIndex = idx >> 3;
    if (byteIndex < 0 || byteIndex >= bitset.length) return false;
    const mask = 1 << (idx & 7);
    return (bitset[byteIndex] & mask) !== 0;
}

export function bitsetSet(bitset: Uint8Array, bitIndex: number, value: boolean): void {
    const idx = Math.trunc(bitIndex);
    if (idx < 0) return;
    const byteIndex = idx >> 3;
    if (byteIndex < 0 || byteIndex >= bitset.length) return;
    const mask = 1 << (idx & 7);
    if (value) bitset[byteIndex] |= mask;
    else bitset[byteIndex] &= ~mask;
}
