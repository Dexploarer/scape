import { timingSafeEqual } from "node:crypto";

import { normalizeWorldScopeId } from "../game/state/PlayerSessionKeys";
import {
    type HostedSessionClaims,
    type HostedSessionKind,
    type HostedSessionService,
} from "./HostedSessionService";

export interface HostedSessionIssueRequest {
    kind?: unknown;
    principalId?: unknown;
    worldId?: unknown;
    worldCharacterId?: unknown;
    displayName?: unknown;
    agentId?: unknown;
    ttlMs?: unknown;
}

export interface HostedSessionIssuerServiceOptions {
    hostedSessionService: HostedSessionService;
    issuerSecret: string;
    worldId: string;
    now?: () => number;
    defaultTtlMs?: number;
    maxTtlMs?: number;
}

export type HostedSessionIssueResult =
    | {
          ok: true;
          status: 200;
          payload: {
              sessionToken: string;
              claims: HostedSessionClaims;
          };
      }
    | {
          ok: false;
          status: 400 | 401 | 503;
          payload: {
              code: string;
              error: string;
          };
      };

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_TTL_MS = 15 * 60 * 1000;

function readBearerToken(authorizationHeader: string | undefined): string | undefined {
    const value = authorizationHeader?.trim();
    if (!value) return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(value);
    return match?.[1]?.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timingSafeStringEquals(left: string, right: string): boolean {
    const leftBuffer = new Uint8Array(Buffer.from(left));
    const rightBuffer = new Uint8Array(Buffer.from(right));
    return (
        leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
    );
}

function nonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

export class HostedSessionIssuerService {
    private readonly hostedSessionService: HostedSessionService;
    private readonly issuerSecret: string;
    private readonly worldId: string;
    private readonly now: () => number;
    private readonly defaultTtlMs: number;
    private readonly maxTtlMs: number;

    constructor(options: HostedSessionIssuerServiceOptions) {
        this.hostedSessionService = options.hostedSessionService;
        this.issuerSecret = options.issuerSecret.trim();
        this.worldId = normalizeWorldScopeId(options.worldId) ?? "default";
        this.now = options.now ?? (() => Date.now());
        this.maxTtlMs = Math.max(1_000, Math.trunc(options.maxTtlMs ?? DEFAULT_MAX_TTL_MS));
        this.defaultTtlMs = Math.min(
            this.maxTtlMs,
            Math.max(1_000, Math.trunc(options.defaultTtlMs ?? DEFAULT_TTL_MS)),
        );
    }

    isEnabled(): boolean {
        return this.issuerSecret.length > 0 && this.hostedSessionService.isEnabled();
    }

    issue(
        authorizationHeader: string | undefined,
        requestBody: unknown,
    ): HostedSessionIssueResult {
        if (!this.isEnabled()) {
            return {
                ok: false,
                status: 503,
                payload: {
                    code: "issuer_disabled",
                    error: "Hosted session issuing is not enabled on this world.",
                },
            };
        }

        const bearerToken = readBearerToken(authorizationHeader);
        if (!bearerToken || !timingSafeStringEquals(bearerToken, this.issuerSecret)) {
            return {
                ok: false,
                status: 401,
                payload: {
                    code: "bad_issuer_token",
                    error: "Authorization bearer token is invalid.",
                },
            };
        }

        if (!isRecord(requestBody)) {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "bad_request",
                    error: "Request body must be a JSON object.",
                },
            };
        }

        const kind = requestBody.kind;
        if (kind !== "human" && kind !== "agent") {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "bad_kind",
                    error: 'kind must be either "human" or "agent".',
                },
            };
        }

        const worldId = nonEmptyString(requestBody.worldId);
        const normalizedWorldId = normalizeWorldScopeId(worldId ?? this.worldId) ?? this.worldId;
        if (normalizedWorldId !== this.worldId) {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "bad_world",
                    error: `worldId must match this world (${this.worldId}).`,
                },
            };
        }

        const principalId = nonEmptyString(requestBody.principalId);
        const worldCharacterId = nonEmptyString(requestBody.worldCharacterId);
        const displayName = nonEmptyString(requestBody.displayName);
        if (!principalId || !worldCharacterId || !displayName) {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "missing_fields",
                    error: "principalId, worldCharacterId, and displayName are required.",
                },
            };
        }

        const agentId = nonEmptyString(requestBody.agentId);
        if (kind === "agent" && !agentId) {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "missing_agent_id",
                    error: "agentId is required when kind is agent.",
                },
            };
        }
        if (kind === "human" && agentId) {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "unexpected_agent_id",
                    error: "agentId is only valid for agent sessions.",
                },
            };
        }

        let ttlMs = this.defaultTtlMs;
        if (requestBody.ttlMs !== undefined) {
            if (
                typeof requestBody.ttlMs !== "number" ||
                !Number.isFinite(requestBody.ttlMs) ||
                requestBody.ttlMs <= 0
            ) {
                return {
                    ok: false,
                    status: 400,
                    payload: {
                        code: "bad_ttl",
                        error: "ttlMs must be a positive number.",
                    },
                };
            }
            ttlMs = Math.trunc(requestBody.ttlMs);
        }
        if (ttlMs > this.maxTtlMs) {
            return {
                ok: false,
                status: 400,
                payload: {
                    code: "ttl_too_large",
                    error: `ttlMs must be <= ${this.maxTtlMs}.`,
                },
            };
        }

        const issuedAt = this.now();
        const expiresAt = issuedAt + ttlMs;
        const claims: Omit<HostedSessionClaims, "version"> = {
            kind: kind as HostedSessionKind,
            principalId,
            worldId: this.worldId,
            worldCharacterId,
            displayName,
            issuedAt,
            expiresAt,
            agentId: agentId ?? undefined,
        };
        const sessionToken = this.hostedSessionService.issue(claims);

        return {
            ok: true,
            status: 200,
            payload: {
                sessionToken,
                claims: {
                    version: 1,
                    ...claims,
                },
            },
        };
    }
}
