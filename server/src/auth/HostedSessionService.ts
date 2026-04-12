import { createHmac, timingSafeEqual } from "node:crypto";

export type HostedSessionKind = "human" | "agent";

export interface HostedSessionClaims {
    version: 1;
    kind: HostedSessionKind;
    principalId: string;
    worldId: string;
    worldCharacterId: string;
    displayName: string;
    issuedAt: number;
    expiresAt: number;
    agentId?: string;
}

export type HostedSessionVerifyResult =
    | { ok: true; claims: HostedSessionClaims }
    | { ok: false; code: string; message: string };

export interface HostedSessionServiceOptions {
    secret: string;
    now?: () => number;
}

function encodeBase64Url(input: string | Uint8Array): string {
    return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input: string): string {
    return Buffer.from(input, "base64url").toString("utf-8");
}

function normalizeNonEmptyString(value: string | undefined, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
        throw new Error(`Hosted session claim "${field}" must be a non-empty string.`);
    }
    return normalized;
}

export class HostedSessionService {
    private readonly secret: string;
    private readonly now: () => number;

    constructor(options: HostedSessionServiceOptions) {
        this.secret = options.secret.trim();
        this.now = options.now ?? (() => Date.now());
    }

    isEnabled(): boolean {
        return this.secret.length > 0;
    }

    issue(claims: Omit<HostedSessionClaims, "version">): string {
        if (!this.isEnabled()) {
            throw new Error("Hosted sessions are disabled.");
        }

        const normalizedClaims: HostedSessionClaims = {
            version: 1,
            kind: claims.kind,
            principalId: normalizeNonEmptyString(claims.principalId, "principalId"),
            worldId: normalizeNonEmptyString(claims.worldId, "worldId"),
            worldCharacterId: normalizeNonEmptyString(claims.worldCharacterId, "worldCharacterId"),
            displayName: normalizeNonEmptyString(claims.displayName, "displayName"),
            issuedAt: Math.max(0, Math.floor(claims.issuedAt)),
            expiresAt: Math.max(0, Math.floor(claims.expiresAt)),
            agentId: claims.agentId?.trim() || undefined,
        };

        const payload = JSON.stringify(normalizedClaims);
        const payloadB64 = encodeBase64Url(payload);
        const signature = this.sign(payloadB64);
        return `hs1.${payloadB64}.${signature}`;
    }

    verify(
        token: string | undefined,
        expected: {
            kind: HostedSessionKind;
            worldId?: string;
            worldCharacterId?: string;
            agentId?: string;
        },
    ): HostedSessionVerifyResult {
        if (!this.isEnabled()) {
            return {
                ok: false,
                code: "hosted_sessions_disabled",
                message: "Hosted session login is not enabled on this world.",
            };
        }

        const trimmed = token?.trim();
        if (!trimmed) {
            return {
                ok: false,
                code: "missing_session_token",
                message: "sessionToken is required.",
            };
        }

        const parts = trimmed.split(".");
        if (parts.length !== 3 || parts[0] !== "hs1") {
            return {
                ok: false,
                code: "bad_session_token",
                message: "Malformed hosted session token.",
            };
        }

        const [, payloadB64, signature] = parts;
        const expectedSignature = this.sign(payloadB64);
        const actualBuffer = new Uint8Array(Buffer.from(signature));
        const expectedBuffer = new Uint8Array(Buffer.from(expectedSignature));
        if (
            actualBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(actualBuffer, expectedBuffer)
        ) {
            return {
                ok: false,
                code: "bad_session_signature",
                message: "Hosted session signature mismatch.",
            };
        }

        let parsed: HostedSessionClaims;
        try {
            parsed = JSON.parse(decodeBase64Url(payloadB64)) as HostedSessionClaims;
        } catch {
            return {
                ok: false,
                code: "bad_session_payload",
                message: "Hosted session payload is not valid JSON.",
            };
        }

        if (parsed.version !== 1) {
            return {
                ok: false,
                code: "bad_session_version",
                message: "Unsupported hosted session token version.",
            };
        }
        if (parsed.kind !== expected.kind) {
            return {
                ok: false,
                code: "bad_session_kind",
                message: "Hosted session token kind mismatch.",
            };
        }
        if (expected.worldId && parsed.worldId !== expected.worldId) {
            return {
                ok: false,
                code: "bad_session_world",
                message: "Hosted session world mismatch.",
            };
        }
        if (expected.worldCharacterId && parsed.worldCharacterId !== expected.worldCharacterId) {
            return {
                ok: false,
                code: "bad_world_character",
                message: "Hosted session world character mismatch.",
            };
        }
        if (expected.agentId && parsed.agentId !== expected.agentId) {
            return {
                ok: false,
                code: "bad_agent_id",
                message: "Hosted session agent id mismatch.",
            };
        }

        const now = this.now();
        if (!Number.isFinite(parsed.issuedAt) || !Number.isFinite(parsed.expiresAt)) {
            return {
                ok: false,
                code: "bad_session_times",
                message: "Hosted session timestamps are invalid.",
            };
        }
        if (parsed.expiresAt <= now) {
            return {
                ok: false,
                code: "session_expired",
                message: "Hosted session expired.",
            };
        }
        if (parsed.issuedAt > now + 60_000) {
            return {
                ok: false,
                code: "session_from_future",
                message: "Hosted session issue time is invalid.",
            };
        }

        return { ok: true, claims: parsed };
    }

    private sign(payloadB64: string): string {
        return createHmac("sha256", this.secret).update(payloadB64).digest("base64url");
    }
}
