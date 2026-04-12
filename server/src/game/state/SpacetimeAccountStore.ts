import { randomFillSync, scryptSync, timingSafeEqual } from "node:crypto";

import { logger } from "../../utils/logger";
import type {
    ControlPlaneClient,
    ControlPlaneLoginAccountRecord,
} from "../../controlplane/ControlPlaneClient";

import type {
    AccountAuthResult,
    AccountRecord,
    AccountStore,
} from "./AccountStore";

const ALGORITHM_V1 = "scrypt-n16384-r8-p1-64" as const;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_SALT_LEN = 16;

function bytesToHex(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
}

function hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
        throw new Error(`invalid hex string length: ${hex.length}`);
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        const byte = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        if (!Number.isFinite(byte)) {
            throw new Error(`invalid hex character at offset ${i * 2}`);
        }
        out[i] = byte;
    }
    return out;
}

function normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
}

function principalIdForUsername(username: string): string {
    return `account:${normalizeUsername(username)}`;
}

function rowToAccountRecord(row: ControlPlaneLoginAccountRecord): AccountRecord {
    return {
        username: row.username,
        passwordHash: row.passwordHash ?? "",
        passwordSalt: row.passwordSalt ?? "",
        algorithm: (row.passwordAlgorithm ?? ALGORITHM_V1) as AccountRecord["algorithm"],
        createdAt: row.createdAt,
        lastLoginAt: row.lastLoginAt,
        banned: row.banned || undefined,
        banReason: row.banReason,
    };
}

export interface SpacetimeAccountStoreOptions {
    client: ControlPlaneClient;
    minPasswordLength?: number;
}

export class SpacetimeAccountStore implements AccountStore {
    private readonly minPasswordLength: number;
    private accounts = new Map<string, AccountRecord>();

    private constructor(private readonly client: ControlPlaneClient, minPasswordLength: number) {
        this.minPasswordLength = minPasswordLength;
    }

    static async create(
        options: SpacetimeAccountStoreOptions,
    ): Promise<SpacetimeAccountStore> {
        const store = new SpacetimeAccountStore(
            options.client,
            Math.max(1, options.minPasswordLength ?? 8),
        );
        await store.loadAll();
        logger.info(
            `[accounts][spacetime] ready with ${store.accounts.size} account(s)`,
        );
        return store;
    }

    private async loadAll(): Promise<void> {
        const rows = await this.client.listLoginAccounts();
        const next = new Map<string, AccountRecord>();
        for (const row of rows) {
            next.set(normalizeUsername(row.username), rowToAccountRecord(row));
        }
        this.accounts = next;
    }

    exists(username: string): boolean {
        return this.accounts.has(normalizeUsername(username));
    }

    size(): number {
        return this.accounts.size;
    }

    verifyOrRegister(username: string, password: string): AccountAuthResult {
        const key = normalizeUsername(username);
        if (!key) {
            return { kind: "wrong_password" };
        }

        try {
            const existing = this.accounts.get(key);
            if (existing) {
                if (existing.banned) {
                    return { kind: "banned", reason: existing.banReason };
                }
                if (!this.verifyPassword(password, existing)) {
                    return { kind: "wrong_password" };
                }
                existing.lastLoginAt = Date.now();
                this.backgroundTouchLastLogin(key, existing.lastLoginAt);
                return { kind: "ok", account: existing, created: false };
            }

            if (password.length < this.minPasswordLength) {
                return {
                    kind: "password_too_short",
                    minLength: this.minPasswordLength,
                };
            }

            const record = this.hashNewPassword(key, password);
            this.accounts.set(key, record);
            this.backgroundInsert(record);
            logger.info(
                `[accounts][spacetime] created new account "${key}" (total=${this.accounts.size})`,
            );
            return { kind: "ok", account: record, created: true };
        } catch (error) {
            return {
                kind: "error",
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    async close(): Promise<void> {
        await this.client.dispose?.();
    }

    private hashNewPassword(username: string, password: string): AccountRecord {
        const salt = new Uint8Array(SCRYPT_SALT_LEN);
        randomFillSync(salt);
        const hash = new Uint8Array(
            scryptSync(password, salt, SCRYPT_KEY_LEN, {
                N: SCRYPT_N,
                r: SCRYPT_R,
                p: SCRYPT_P,
            }),
        );
        return {
            username,
            passwordHash: bytesToHex(hash),
            passwordSalt: bytesToHex(salt),
            algorithm: ALGORITHM_V1,
            createdAt: Date.now(),
        };
    }

    private verifyPassword(password: string, record: AccountRecord): boolean {
        if (record.algorithm !== ALGORITHM_V1) {
            logger.warn(`[accounts][spacetime] unknown algorithm "${record.algorithm}" for ${record.username}`);
            return false;
        }

        const salt = hexToBytes(record.passwordSalt);
        const expected = hexToBytes(record.passwordHash);
        const actual = new Uint8Array(
            scryptSync(password, salt, SCRYPT_KEY_LEN, {
                N: SCRYPT_N,
                r: SCRYPT_R,
                p: SCRYPT_P,
            }),
        );
        return (
            expected.byteLength === actual.byteLength &&
            timingSafeEqual(expected, actual)
        );
    }

    private backgroundInsert(record: AccountRecord): void {
        const principalId = principalIdForUsername(record.username);
        void this.client
            .upsertPrincipal({
                principalId,
                principalKind: "human",
                canonicalName: record.username,
                createdAt: record.createdAt,
                updatedAt: record.createdAt,
            })
            .then(() =>
                this.client.upsertLoginAccount({
                    username: record.username,
                    principalId,
                    authMode: "password",
                    passwordHash: record.passwordHash,
                    passwordSalt: record.passwordSalt,
                    passwordAlgorithm: record.algorithm,
                    banned: !!record.banned,
                    banReason: record.banReason,
                    createdAt: record.createdAt,
                    lastLoginAt: record.lastLoginAt,
                }),
            )
            .catch((error) => {
                logger.warn(
                    `[accounts][spacetime] failed to persist account "${record.username}"`,
                    error,
                );
            });
    }

    private backgroundTouchLastLogin(username: string, lastLoginAt: number): void {
        void this.client.touchLoginAccount(username, lastLoginAt).catch((error) => {
            logger.warn(
                `[accounts][spacetime] failed to update last_login_at for "${username}"`,
                error,
            );
        });
    }
}
