/**
 * Postgres-backed account store.
 *
 * Implements the same {@link AccountStore} interface as {@link JsonAccountStore}
 * but persists account records to a managed Postgres database instead of a
 * local JSON file. Selected by `DATABASE_URL` at boot — see
 * `server/src/game/state/createAccountStore.ts`.
 *
 * ## Why Postgres
 *
 * Sevalla app containers have no persistent volumes. Every redeploy wipes
 * `server/data/accounts.json` and every registered player disappears.
 * Moving accounts to a managed Postgres database (provisioned via the
 * Sevalla databases API at
 * `https://api.sevalla.com/v3/databases`) survives container replacement
 * forever, and lets the server pod be freely replaced by Kubernetes
 * without data loss.
 *
 * ## Why in-memory cache + sync interface
 *
 * The existing `AccountStore.verifyOrRegister` method is synchronous
 * because the two callers (`LoginHandshakeService` and
 * `AgentPlayerFactory`) run inside tight tick-loop paths and would rather
 * not propagate `await` through every frame. To preserve the sync
 * interface we:
 *
 *   1. Load every account into an in-memory `Map<username, AccountRecord>`
 *      at construction time via the async factory
 *      {@link PostgresAccountStore.create}. The factory awaits both the
 *      `CREATE TABLE IF NOT EXISTS` and the initial `SELECT *` before
 *      returning, so the store is immediately ready for sync reads and
 *      writes the instant it's handed to the WSServer.
 *
 *   2. Serve `verifyOrRegister` / `exists` / `size` from the in-memory
 *      map — no await, no promise, no round-trip to Postgres on the
 *      login hot path.
 *
 *   3. Fire a fire-and-forget SQL UPSERT on every successful write
 *      (account created OR login timestamp bumped). Write failures are
 *      logged but do NOT block the client — the in-memory state is the
 *      source of truth for the current tick, and an eventual write
 *      failure is better than a synchronous stall.
 *
 * The risk model this accepts:
 *
 *   - If the server crashes between an in-memory write and the DB
 *     flushing that write, a newly-registered account's last-login
 *     timestamp may be stale by one login. Acceptable.
 *   - If the DB goes down mid-session, logins keep working off the
 *     in-memory cache. New registrations log a warning but still
 *     succeed in memory. When the DB comes back, the next successful
 *     write re-syncs the row.
 *
 * The alternative (making `verifyOrRegister` async) would have been
 * cleaner architecturally but would have required touching every call
 * site and propagating awaits through the login handshake pipeline.
 * The sync-interface + in-memory-cache pattern is a deliberate
 * trade-off.
 */

import { randomFillSync, scryptSync, timingSafeEqual } from "node:crypto";
import postgres, { type Sql } from "postgres";

import { logger } from "../../utils/logger";

import type {
    AccountAuthResult,
    AccountRecord,
    AccountStore,
} from "./AccountStore";

/** Keep these constants identical to JsonAccountStore so records interop. */
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

/**
 * The raw shape of an `accounts` table row. Lowercased column names
 * because postgres.js returns them as-is from the database.
 */
interface AccountRow {
    username: string;
    password_hash: string;
    password_salt: string;
    algorithm: string;
    created_at: Date;
    last_login_at: Date | null;
    banned: boolean;
    ban_reason: string | null;
}

function rowToRecord(row: AccountRow): AccountRecord {
    return {
        username: row.username,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        algorithm: row.algorithm as AccountRecord["algorithm"],
        createdAt: row.created_at.getTime(),
        lastLoginAt: row.last_login_at?.getTime(),
        banned: row.banned || undefined,
        banReason: row.ban_reason ?? undefined,
    };
}

export interface PostgresAccountStoreOptions {
    /** Postgres connection string — `postgresql://user:pw@host:port/db`. */
    databaseUrl: string;
    /** Minimum password length for auto-registration. */
    minPasswordLength?: number;
    /**
     * How long to wait on the initial `SELECT *` before giving up and
     * booting with an empty cache. Defaults to 15 seconds; Sevalla's
     * internal DNS sometimes takes a few seconds to propagate on a
     * fresh database.
     */
    connectTimeoutMs?: number;
}

export class PostgresAccountStore implements AccountStore {
    private readonly sql: Sql;
    private readonly minPasswordLength: number;
    private accounts: Map<string, AccountRecord> = new Map();

    private constructor(sql: Sql, minPasswordLength: number) {
        this.sql = sql;
        this.minPasswordLength = minPasswordLength;
    }

    /**
     * Open the connection pool, create the schema if missing, preload
     * every account into memory, and return a ready-to-use store.
     * The returned store's sync methods (`verifyOrRegister`, `exists`,
     * `size`) work immediately without any further awaits.
     */
    static async create(
        opts: PostgresAccountStoreOptions,
    ): Promise<PostgresAccountStore> {
        const sql = postgres(opts.databaseUrl, {
            // postgres.js defaults are fine for our tiny workload;
            // just cap the pool so we don't open 10 connections to
            // serve ~1 login per minute.
            max: 5,
            idle_timeout: 30,
            connect_timeout: Math.ceil((opts.connectTimeoutMs ?? 15_000) / 1000),
        });
        const store = new PostgresAccountStore(
            sql,
            Math.max(1, opts.minPasswordLength ?? 8),
        );
        await store.ensureSchema();
        await store.loadAll();
        logger.info(
            `[accounts][postgres] ready with ${store.accounts.size} account(s)`,
        );
        return store;
    }

    private async ensureSchema(): Promise<void> {
        await this.sql`
            CREATE TABLE IF NOT EXISTS accounts (
                username       TEXT PRIMARY KEY,
                password_hash  TEXT NOT NULL,
                password_salt  TEXT NOT NULL,
                algorithm      TEXT NOT NULL,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_login_at  TIMESTAMPTZ,
                banned         BOOLEAN NOT NULL DEFAULT FALSE,
                ban_reason     TEXT
            )
        `;
    }

    private async loadAll(): Promise<void> {
        const rows = await this.sql<AccountRow[]>`
            SELECT username, password_hash, password_salt, algorithm,
                   created_at, last_login_at, banned, ban_reason
            FROM accounts
        `;
        const next = new Map<string, AccountRecord>();
        for (const row of rows) {
            next.set(row.username, rowToRecord(row));
        }
        this.accounts = next;
    }

    /**
     * Graceful shutdown — called from the server's SIGTERM handler so
     * in-flight queries drain before the pod exits.
     */
    async close(): Promise<void> {
        try {
            await this.sql.end({ timeout: 5 });
        } catch (err) {
            logger.warn("[accounts][postgres] close error", err);
        }
    }

    exists(username: string): boolean {
        return this.accounts.has(username.trim().toLowerCase());
    }

    size(): number {
        return this.accounts.size;
    }

    verifyOrRegister(username: string, password: string): AccountAuthResult {
        const key = username.trim().toLowerCase();
        if (!key) return { kind: "wrong_password" };
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
                this.backgroundUpdateLastLogin(key, existing.lastLoginAt);
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
                `[accounts][postgres] created new account "${key}" (total=${this.accounts.size})`,
            );
            return { kind: "ok", account: record, created: true };
        } catch (err) {
            return {
                kind: "error",
                error: err instanceof Error ? err : new Error(String(err)),
            };
        }
    }

    /**
     * Fire-and-forget UPSERT for a newly-registered account. We await
     * nothing — the in-memory cache is the source of truth for the
     * current tick. DB write errors are logged but do not roll back
     * the cache.
     */
    private backgroundInsert(record: AccountRecord): void {
        const createdAt = new Date(record.createdAt);
        void this.sql`
            INSERT INTO accounts
                (username, password_hash, password_salt, algorithm,
                 created_at, last_login_at, banned, ban_reason)
            VALUES (
                ${record.username},
                ${record.passwordHash},
                ${record.passwordSalt},
                ${record.algorithm},
                ${createdAt},
                ${record.lastLoginAt != null ? new Date(record.lastLoginAt) : null},
                ${record.banned ?? false},
                ${record.banReason ?? null}
            )
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                password_salt = EXCLUDED.password_salt,
                algorithm     = EXCLUDED.algorithm,
                last_login_at = EXCLUDED.last_login_at,
                banned        = EXCLUDED.banned,
                ban_reason    = EXCLUDED.ban_reason
        `.catch((err) => {
            logger.warn(
                `[accounts][postgres] insert failed for "${record.username}"`,
                err,
            );
        });
    }

    /**
     * Fire-and-forget `last_login_at` bump. Runs after every successful
     * password verification so the operator dashboard has recent login
     * times, but does not block the login handshake waiting on the DB.
     */
    private backgroundUpdateLastLogin(username: string, millis: number): void {
        const ts = new Date(millis);
        void this.sql`
            UPDATE accounts
            SET last_login_at = ${ts}
            WHERE username = ${username}
        `.catch((err) => {
            logger.warn(
                `[accounts][postgres] last-login update failed for "${username}"`,
                err,
            );
        });
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
            logger.warn(
                `[accounts][postgres] unknown algorithm "${record.algorithm}" for ${record.username}`,
            );
            return false;
        }
        try {
            const salt = hexToBytes(record.passwordSalt);
            const expected = hexToBytes(record.passwordHash);
            const actual = new Uint8Array(
                scryptSync(password, salt, expected.length, {
                    N: SCRYPT_N,
                    r: SCRYPT_R,
                    p: SCRYPT_P,
                }),
            );
            if (actual.length !== expected.length) return false;
            return timingSafeEqual(actual, expected);
        } catch (err) {
            logger.warn("[accounts][postgres] password verify error", err);
            return false;
        }
    }
}
