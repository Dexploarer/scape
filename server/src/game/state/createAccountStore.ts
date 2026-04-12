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
import type { ServerRuntimeMode } from "../../config";

import type { AccountStore } from "./AccountStore";
import { JsonAccountStore } from "./AccountStore";
import { PostgresAccountStore } from "./PostgresAccountStore";
import { SpacetimeControlPlaneClient } from "../../controlplane/SpacetimeControlPlaneClient";
import { SpacetimeAccountStore } from "./SpacetimeAccountStore";

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
    /**
     * When true, a DATABASE_URL bootstrap failure falls back to the
     * JSON store instead of aborting startup.
     */
    allowJsonFallbackOnDatabaseError?: boolean;
    /** Server runtime mode used to enforce durable storage in production. */
    runtimeMode?: ServerRuntimeMode;
    /** Shared SpacetimeDB control-plane URI. */
    spacetimeUri?: string;
    /** Shared SpacetimeDB database name. */
    spacetimeDatabase?: string;
    /** Optional shared SpacetimeDB auth token. */
    spacetimeAuthToken?: string;
    /**
     * When true, allow JSON-backed accounts even in production mode.
     * Only use this with an explicitly durable mounted volume.
     */
    allowJsonStoreInProduction?: boolean;
}

function assertJsonStoreAllowed(opts: CreateAccountStoreOptions): void {
    const runtimeMode = opts.runtimeMode ?? "development";
    if (runtimeMode !== "production") return;
    if (opts.allowJsonStoreInProduction) {
        logger.warn(
            "[accounts] production JSON account storage explicitly enabled — ensure the file path is on durable storage",
        );
        return;
    }
    throw new Error(
        "Production account storage requires DATABASE_URL. JSON account storage is blocked in production because hosted app updates wipe local files. Set DATABASE_URL or ALLOW_JSON_ACCOUNT_STORE_IN_PRODUCTION=true only if you mounted durable storage yourself.",
    );
}

export async function createAccountStore(
    opts: CreateAccountStoreOptions,
): Promise<AccountStore> {
    const spacetimeUri = opts.spacetimeUri?.trim();
    const spacetimeDatabase = opts.spacetimeDatabase?.trim();
    if (spacetimeUri && spacetimeDatabase) {
        logger.info("[accounts] SPACETIMEDB_* set → using SpacetimeAccountStore");
        try {
            const client = await SpacetimeControlPlaneClient.connect({
                uri: spacetimeUri,
                database: spacetimeDatabase,
                authToken: opts.spacetimeAuthToken,
            });
            return await SpacetimeAccountStore.create({
                client,
                minPasswordLength: opts.minPasswordLength,
            });
        } catch (err) {
            if (!opts.allowJsonFallbackOnDatabaseError) {
                logger.error(
                    "[accounts] SpacetimeDB init failed and JSON fallback is disabled",
                    err,
                );
                throw err instanceof Error ? err : new Error(String(err));
            }
            assertJsonStoreAllowed(opts);
            logger.error(
                "[accounts] SpacetimeDB init failed, falling back to JsonAccountStore",
                err,
            );
        }
    }

    const url = opts.databaseUrl?.trim();
    if (url && url.length > 0) {
        logger.info("[accounts] DATABASE_URL set → using PostgresAccountStore");
        try {
            return await PostgresAccountStore.create({
                databaseUrl: url,
                minPasswordLength: opts.minPasswordLength,
            });
        } catch (err) {
            if (!opts.allowJsonFallbackOnDatabaseError) {
                logger.error(
                    "[accounts] Postgres init failed and JSON fallback is disabled",
                    err,
                );
                throw err instanceof Error ? err : new Error(String(err));
            }
            assertJsonStoreAllowed(opts);
            logger.error(
                "[accounts] Postgres init failed, falling back to JsonAccountStore",
                err,
            );
        }
    } else {
        assertJsonStoreAllowed(opts);
        logger.info(
            "[accounts] DATABASE_URL not set → using JsonAccountStore (ephemeral in hosted deployments)",
        );
    }
    return new JsonAccountStore({
        filePath: opts.jsonFilePath,
        minPasswordLength: opts.minPasswordLength,
    });
}
