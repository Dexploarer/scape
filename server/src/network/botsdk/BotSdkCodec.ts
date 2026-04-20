/**
 * TOON encode/decode adapter for bot-SDK frames.
 *
 * Wraps `@toon-format/toon` with thin helpers tailored to our wire format:
 *
 *   1. **Everything is a top-level object.** The TOON encoder produces the
 *      most compact output when it has a single root object with arrays
 *      inside. We don't ship raw arrays or primitives on the wire.
 *
 *   2. **Frame kind is the first key.** Decoders can cheaply peek at the
 *      `kind` field without parsing the whole payload.
 *
 *   3. **Errors are never thrown from hot paths.** Decode returns
 *      `{ok: false, error}` instead so the server never crashes on a
 *      malformed client frame.
 *
 * This module is *not* a general-purpose TOON utility; it's scoped to the
 * bot-SDK layer. If you need TOON encoding elsewhere, import
 * `@toon-format/toon` directly.
 */

import { decode, encode } from "@toon-format/toon";

import type { ClientFrame, ServerFrame } from "./BotSdkProtocol";

export type BotSdkWireFormat = "toon" | "json";

export interface CodecOk<T> {
    ok: true;
    value: T;
}

export interface CodecError {
    ok: false;
    error: string;
}

export type CodecResult<T> = CodecOk<T> | CodecError;
export interface DecodedClientFrame {
    frame: ClientFrame;
    format: BotSdkWireFormat;
}

function normalizeClientFrame(value: unknown): CodecResult<ClientFrame> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, error: "frame root is not an object" };
    }
    const obj = value as Record<string, unknown>;
    const kind =
        typeof obj.kind === "string"
            ? obj.kind
            : typeof obj.type === "string"
                ? obj.type
                : undefined;
    if (!kind) {
        return { ok: false, error: "missing or non-string `kind`/`type` field" };
    }
    return {
        ok: true,
        value: {
            ...obj,
            kind,
        } as unknown as ClientFrame,
    };
}

export function guessClientFrameFormat(raw: string): BotSdkWireFormat {
    return raw.trim().startsWith("{") ? "json" : "toon";
}

/**
 * Encode a server → client frame as either TOON or JSON.
 * Never throws — both encoders are total over JSON-compatible inputs and
 * our `ServerFrame` types are structurally JSON-safe.
 */
export function encodeServerFrame(
    frame: ServerFrame,
    format: BotSdkWireFormat = "toon",
): string {
    if (format === "json") {
        return JSON.stringify(frame);
    }
    return encode(frame as unknown as Record<string, unknown>);
}

/**
 * Decode an incoming client frame from either raw JSON or TOON into a typed
 * {@link ClientFrame}. Returns `{ok:false}` for any parse error or missing
 * `kind` / `type` field — the caller decides what to do (usually send an
 * error frame and close the socket).
 */
export function decodeClientFrame(raw: string): CodecResult<DecodedClientFrame> {
    if (typeof raw !== "string" || raw.length === 0) {
        return { ok: false, error: "empty frame" };
    }

    const guessedFormat = guessClientFrameFormat(raw);
    if (guessedFormat === "json") {
        try {
            const jsonValue = JSON.parse(raw);
            const normalized = normalizeClientFrame(jsonValue);
            if (normalized.ok) {
                return {
                    ok: true,
                    value: {
                        frame: normalized.value,
                        format: "json",
                    },
                };
            }
        } catch {
            // Fall through and let TOON decoding report the final parse failure.
        }
    }

    let toonValue: unknown;
    try {
        toonValue = decode(raw);
    } catch (err) {
        if (guessedFormat === "json") {
            return {
                ok: false,
                error: `json/toon decode failed: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        return {
            ok: false,
            error: `toon decode failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }

    const normalized = normalizeClientFrame(toonValue);
    if (!normalized.ok) {
        return normalized;
    }
    return {
        ok: true,
        value: {
            frame: normalized.value,
            format: "toon",
        },
    };
}
