/**
 * BinaryProtocol - Binary message encoding
 *
 * All server-to-client messages use binary encoding.
 * JSON protocol has been completely removed.
 */
import type { WebSocket } from "ws";

import { ServerBinaryEncoder, serverEncoder } from "./ServerBinaryEncoder";

/**
 * Send a binary message over WebSocket
 */
export function sendMessage(ws: WebSocket | undefined, type: string, payload: any): void {
    if (!ws || ws.readyState !== 1 /* WebSocket.OPEN */) return;

    // Import encodeMessage dynamically to avoid circular dependency
    try {
        const { encodeMessage } = require("../messages");
        const binary = encodeMessage({ type, payload });
        if (!binary || !(binary instanceof Uint8Array) || binary.length === 0) return;
        ws.send(binary);
    } catch (err) {
        console.log(`[binary] failed to send message type="${type}"`, err);
    }
}

// Re-export encoder for direct use
export { serverEncoder, ServerBinaryEncoder };
