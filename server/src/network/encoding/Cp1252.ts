/**
 * CP1252 (Windows-1252) encoding utilities for OSRS text streams.
 *
 * OSRS uses CP1252 encoding for player names, chat messages, and other text.
 * This maps Unicode code points to their CP1252 byte equivalents.
 */

/** CP1252 encoding map: Unicode code point -> CP1252 byte */
const CP1252_MAP: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
};

/**
 * Encode a string to CP1252 bytes.
 * Characters not representable in CP1252 are replaced with '?' (0x3f).
 */
export function encodeCp1252(text: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < text.length; i++) {
        const codePoint = text.codePointAt(i) ?? 0;
        if (codePoint > 0xffff) i++; // Skip surrogate pair
        if ((codePoint >= 0 && codePoint <= 0x7f) || (codePoint >= 0xa0 && codePoint <= 0xff)) {
            out.push(codePoint & 0xff);
            continue;
        }
        const mapped = CP1252_MAP[codePoint];
        out.push(mapped !== undefined ? mapped : 0x3f);
    }
    return out;
}

/**
 * Encode a string to CP1252 as Uint8Array.
 */
export function encodeCp1252Bytes(text: string): Uint8Array {
    return Uint8Array.from(encodeCp1252(text));
}
