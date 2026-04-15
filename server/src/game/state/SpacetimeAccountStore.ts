import type { ControlPlaneClient } from "../../controlplane/ControlPlaneClient";
import { buildLocalPrincipalId, nowMicros } from "./SpacetimeStateIds";
import { logger } from "../../utils/logger";
import {
    ACCOUNT_ALGORITHM_V1,
    createPasswordAccountRecord,
    type AccountAuthResult,
    type AccountRecord,
    type ManagedAccountStore,
    verifyPasswordAgainstRecord,
} from "./AccountStore";

const PASSWORD_AUTH_MODE = "password";

function normalizeAccountUsername(username: string): string {
    return username.trim().toLowerCase();
}

function rowToAccountRecord(row: Awaited<ReturnType<ControlPlaneClient["listLoginAccounts"]>>[number]): AccountRecord {
    return {
        username: normalizeAccountUsername(row.username),
        passwordHash: row.password_hash ?? "",
        passwordSalt: row.password_salt ?? "",
        algorithm:
            row.password_algorithm === ACCOUNT_ALGORITHM_V1
                ? ACCOUNT_ALGORITHM_V1
                : ACCOUNT_ALGORITHM_V1,
        createdAt: Number(row.created_at),
        lastLoginAt: row.last_login_at === undefined ? undefined : Number(row.last_login_at),
        banned: row.banned,
        banReason: row.ban_reason ?? undefined,
    };
}

export interface SpacetimeAccountStoreOptions {
    controlPlane: ControlPlaneClient;
    minPasswordLength?: number;
}

export class SpacetimeAccountStore implements ManagedAccountStore {
    private readonly minPasswordLength: number;
    private readonly accounts = new Map<string, AccountRecord>();
    private writeChain: Promise<void> = Promise.resolve();

    constructor(private readonly options: SpacetimeAccountStoreOptions) {
        this.minPasswordLength = Math.max(1, options.minPasswordLength ?? 8);
    }

    async initialize(): Promise<void> {
        const rows = await this.options.controlPlane.listLoginAccounts();
        this.accounts.clear();
        for (const row of rows) {
            if (row.auth_mode !== PASSWORD_AUTH_MODE) continue;
            this.accounts.set(normalizeAccountUsername(row.username), rowToAccountRecord(row));
        }
        logger.info(`[spacetime] loaded ${this.accounts.size} password account(s)`);
    }

    async dispose(): Promise<void> {
        await this.writeChain;
    }

    exists(username: string): boolean {
        return this.accounts.has(normalizeAccountUsername(username));
    }

    size(): number {
        return this.accounts.size;
    }

    verifyOrRegister(username: string, password: string): AccountAuthResult {
        const key = normalizeAccountUsername(username);
        if (!key) return { kind: "wrong_password" };

        const existing = this.accounts.get(key);
        if (existing) {
            if (existing.banned) {
                return { kind: "banned", reason: existing.banReason };
            }
            if (!existing.passwordHash || !existing.passwordSalt) {
                return { kind: "wrong_password" };
            }
            if (!verifyPasswordAgainstRecord(password, existing)) {
                return { kind: "wrong_password" };
            }
            existing.lastLoginAt = Date.now();
            this.enqueueWrite(async () => {
                await this.options.controlPlane.touchLoginAccount({
                    username: key,
                    last_login_at: nowMicros(),
                });
            });
            return { kind: "ok", account: existing, created: false };
        }

        if (password.length < this.minPasswordLength) {
            return { kind: "password_too_short", minLength: this.minPasswordLength };
        }

        const record = createPasswordAccountRecord(key, password);
        this.accounts.set(key, record);

        this.enqueueWrite(async () => {
            const timestampMicros = BigInt(record.createdAt) * 1000n;
            const principalId = buildLocalPrincipalId(record.username);
            await this.options.controlPlane.upsertPrincipal({
                principal_id: principalId,
                principal_kind: "account",
                canonical_name: record.username,
                created_at: timestampMicros,
                updated_at: timestampMicros,
            });
            await this.options.controlPlane.upsertLoginAccount({
                username: record.username,
                principal_id: principalId,
                auth_mode: PASSWORD_AUTH_MODE,
                password_hash: record.passwordHash,
                password_salt: record.passwordSalt,
                password_algorithm: record.algorithm,
                external_subject: undefined,
                banned: false,
                ban_reason: undefined,
                created_at: timestampMicros,
                last_login_at: undefined,
            });
        });

        logger.info(`[spacetime] created new account "${key}" (total=${this.accounts.size})`);
        return { kind: "ok", account: record, created: true };
    }

    private enqueueWrite(task: () => Promise<void>): void {
        this.writeChain = this.writeChain
            .then(task)
            .catch((error) => {
                logger.error("[spacetime] account write failed", error);
            });
    }
}
