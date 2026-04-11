/**
 * AccountStore factory — picks the right backend based on config.
 *
 * If `DATABASE_URL` is set, construct an async-loaded
 * {@link PostgresAccountStore}. Otherwise fall back to the local
 * {@link JsonAccountStore} file store for dev and self-hosted
 * deployments that don't have a managed database.
 *
 * The returned `AccountStore` is fully loaded and ready for sync
 * `verifyOrRegister` calls — callers do NOT need to await anything
 * before passing it into the WSServer constructor.
 */

import { logger } from "../../utils/logger";

import type { AccountStore } from "./AccountStore";
import { JsonAccountStore } from "./AccountStore";
import { PostgresAccountStore } from "./PostgresAccountStore";

export interface CreateAccountStoreOptions {
    /**
     * Postgres connection string. When unset / empty, the JSON file
     * backend is used. Typically sourced from `process.env.DATABASE_URL`.
     */
    databaseUrl?: string;
    /** Path to the JSON file used by the fallback backend. */
    jsonFilePath: string;
    /** Minimum password length for both backends. */
    minPasswordLength: number;
}

export async function createAccountStore(
    opts: CreateAccountStoreOptions,
): Promise<AccountStore> {
    const url = opts.databaseUrl?.trim();
    if (url && url.length > 0) {
        logger.info("[accounts] DATABASE_URL set → using PostgresAccountStore");
        try {
            return await PostgresAccountStore.create({
                databaseUrl: url,
                minPasswordLength: opts.minPasswordLength,
            });
        } catch (err) {
            logger.error(
                "[accounts] Postgres init failed, falling back to JsonAccountStore",
                err,
            );
        }
    } else {
        logger.info(
            "[accounts] DATABASE_URL not set → using JsonAccountStore (ephemeral in hosted deployments)",
        );
    }
    return new JsonAccountStore({
        filePath: opts.jsonFilePath,
        minPasswordLength: opts.minPasswordLength,
    });
}
