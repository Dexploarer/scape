/**
 * Ogg Vorbis container builder for OSRS custom format.
 * Reconstructs valid Ogg Vorbis streams from OSRS's raw packets + separate setup header.
 */

/**
 * CRC32 lookup table for Ogg pages (polynomial 0x04c11db7)
 */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i << 24;
        for (let j = 0; j < 8; j++) {
            crc = (crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0);
        }
        table[i] = crc >>> 0;
    }
    return table;
})();

function oggCrc32(data: Uint8Array): number {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
    }
    return crc;
}

/**
 * Build an Ogg page
 */
function buildOggPage(
    granulePosition: bigint,
    serialNumber: number,
    pageSequence: number,
    headerType: number,
    segments: Uint8Array[],
): Uint8Array {
    // Calculate segment table
    const segmentTable: number[] = [];
    for (const seg of segments) {
        let remaining = seg.length;
        while (remaining >= 255) {
            segmentTable.push(255);
            remaining -= 255;
        }
        segmentTable.push(remaining);
    }

    // Total data size
    const dataSize = segments.reduce((sum, s) => sum + s.length, 0);
    const headerSize = 27 + segmentTable.length;
    const pageSize = headerSize + dataSize;

    const page = new Uint8Array(pageSize);
    const view = new DataView(page.buffer);

    // Magic "OggS"
    page[0] = 0x4f;
    page[1] = 0x67;
    page[2] = 0x67;
    page[3] = 0x53;

    // Version
    page[4] = 0;

    // Header type
    page[5] = headerType;

    // Granule position (64-bit little-endian)
    view.setBigUint64(6, granulePosition, true);

    // Serial number
    view.setUint32(14, serialNumber, true);

    // Page sequence number
    view.setUint32(18, pageSequence, true);

    // CRC (placeholder, calculated after)
    view.setUint32(22, 0, true);

    // Number of segments
    page[26] = segmentTable.length;

    // Segment table
    for (let i = 0; i < segmentTable.length; i++) {
        page[27 + i] = segmentTable[i];
    }

    // Page data
    let offset = headerSize;
    for (const seg of segments) {
        page.set(seg, offset);
        offset += seg.length;
    }

    // Calculate and set CRC
    const crc = oggCrc32(page);
    view.setUint32(22, crc, true);

    return page;
}

/**
 * Build Vorbis identification header
 */
function buildIdentificationHeader(
    channels: number,
    sampleRate: number,
    blocksize0: number,
    blocksize1: number,
): Uint8Array {
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);

    // Packet type (1 = identification)
    header[0] = 1;

    // "vorbis"
    header[1] = 0x76; // v
    header[2] = 0x6f; // o
    header[3] = 0x72; // r
    header[4] = 0x62; // b
    header[5] = 0x69; // i
    header[6] = 0x73; // s

    // Version (0)
    view.setUint32(7, 0, true);

    // Channels
    header[11] = channels;

    // Sample rate
    view.setUint32(12, sampleRate, true);

    // Bitrate maximum (0 = unset)
    view.setInt32(16, 0, true);

    // Bitrate nominal (0 = unset)
    view.setInt32(20, 0, true);

    // Bitrate minimum (0 = unset)
    view.setInt32(24, 0, true);

    // Block sizes (4 bits each, log2)
    const bs0Log = Math.log2(blocksize0) | 0;
    const bs1Log = Math.log2(blocksize1) | 0;
    header[28] = (bs1Log << 4) | bs0Log;

    // Framing flag
    header[29] = 1;

    return header;
}

/**
 * Build minimal Vorbis comment header
 */
function buildCommentHeader(): Uint8Array {
    const vendor = "OSRS-TS";
    const vendorBytes = new TextEncoder().encode(vendor);

    const header = new Uint8Array(7 + 4 + vendorBytes.length + 4 + 1);
    const view = new DataView(header.buffer);

    let offset = 0;

    // Packet type (3 = comment)
    header[offset++] = 3;

    // "vorbis"
    header[offset++] = 0x76;
    header[offset++] = 0x6f;
    header[offset++] = 0x72;
    header[offset++] = 0x62;
    header[offset++] = 0x69;
    header[offset++] = 0x73;

    // Vendor length
    view.setUint32(offset, vendorBytes.length, true);
    offset += 4;

    // Vendor string
    header.set(vendorBytes, offset);
    offset += vendorBytes.length;

    // User comment list length (0)
    view.setUint32(offset, 0, true);
    offset += 4;

    // Framing flag
    header[offset] = 1;

    return header;
}

/**
 * Build Vorbis setup header from OSRS raw setup data
 */
function buildSetupHeader(osrsSetupData: Uint8Array): Uint8Array {
    // OSRS setup data is raw setup without the 7-byte Vorbis header prefix
    const header = new Uint8Array(7 + osrsSetupData.length);

    // Packet type (5 = setup)
    header[0] = 5;

    // "vorbis"
    header[1] = 0x76;
    header[2] = 0x6f;
    header[3] = 0x72;
    header[4] = 0x62;
    header[5] = 0x69;
    header[6] = 0x73;

    // Raw setup data
    header.set(osrsSetupData, 7);

    return header;
}

/**
 * Parse OSRS setup header to extract block sizes
 */
function parseOsrsSetupBlockSizes(setupData: Uint8Array): {
    blocksize0: number;
    blocksize1: number;
} {
    // First byte contains two 4-bit values: blocksize0 and blocksize1 (as log2)
    const byte = setupData[0];
    const bs0Bits = byte & 0x0f;
    const bs1Bits = (byte >> 4) & 0x0f;

    return {
        blocksize0: 1 << bs0Bits,
        blocksize1: 1 << bs1Bits,
    };
}

export interface OsrsSampleInfo {
    sampleRate: number;
    sampleCount: number;
    start: number;
    end: number;
    looped: boolean;
    packets: Uint8Array[];
}

/**
 * Build complete Ogg Vorbis stream from OSRS format
 */
export function buildOggVorbisStream(
    setupData: Uint8Array,
    sample: OsrsSampleInfo,
    channels: number = 1,
): Uint8Array {
    const serialNumber = 0x4f535253; // "OSRS"
    let pageSequence = 0;

    const { blocksize0, blocksize1 } = parseOsrsSetupBlockSizes(setupData);

    // Build headers
    const idHeader = buildIdentificationHeader(channels, sample.sampleRate, blocksize0, blocksize1);
    const commentHeader = buildCommentHeader();
    const setupHeader = buildSetupHeader(setupData);

    const pages: Uint8Array[] = [];

    // Page 1: BOS with identification header
    pages.push(
        buildOggPage(
            0n,
            serialNumber,
            pageSequence++,
            0x02, // BOS flag
            [idHeader],
        ),
    );

    // Page 2: Comment + Setup headers
    pages.push(
        buildOggPage(
            0n,
            serialNumber,
            pageSequence++,
            0x00, // continuation
            [commentHeader, setupHeader],
        ),
    );

    // Audio pages
    let granulePos = 0n;
    const samplesPerPacket = blocksize1 / 2; // Approximate

    for (let i = 0; i < sample.packets.length; i++) {
        const packet = sample.packets[i];
        const isLast = i === sample.packets.length - 1;

        granulePos += BigInt(samplesPerPacket);

        // For last packet, set granule to actual sample count
        if (isLast) {
            granulePos = BigInt(sample.sampleCount);
        }

        pages.push(
            buildOggPage(
                granulePos,
                serialNumber,
                pageSequence++,
                isLast ? 0x04 : 0x00, // EOS flag on last page
                [packet],
            ),
        );
    }

    // Concatenate all pages
    const totalSize = pages.reduce((sum, p) => sum + p.length, 0);
    const stream = new Uint8Array(totalSize);
    let offset = 0;
    for (const page of pages) {
        stream.set(page, offset);
        offset += page.length;
    }

    return stream;
}
