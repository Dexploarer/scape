import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JsonAccountStore } from "../server/src/game/state/AccountStore";
import { createAccountStore } from "../server/src/game/state/createAccountStore";
import { PostgresAccountStore } from "../server/src/game/state/PostgresAccountStore";

const tempFiles: string[] = [];

function makeTempFilePath(label: string): string {
    const path = join(
        tmpdir(),
        `scape-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );
    tempFiles.push(path);
    return path;
}

afterEach(() => {
    for (const filePath of tempFiles.splice(0)) {
        try {
            rmSync(filePath, { force: true });
        } catch {}
    }
});

describe("JsonAccountStore", () => {
    test("auto-registers on first login and validates reused credentials", () => {
        const store = new JsonAccountStore({
            filePath: makeTempFilePath("accounts"),
            minPasswordLength: 8,
        });

        const created = store.verifyOrRegister("Alice", "hunter22");
        const reused = store.verifyOrRegister("Alice", "hunter22");
        const wrongPassword = store.verifyOrRegister("Alice", "wrongpass");

        expect(created.kind).toBe("ok");
        expect(created.kind === "ok" ? created.created : false).toBe(true);
        expect(reused.kind).toBe("ok");
        expect(reused.kind === "ok" ? reused.created : true).toBe(false);
        expect(wrongPassword).toEqual({ kind: "wrong_password" });
        expect(store.exists("alice")).toBe(true);
        expect(store.size()).toBe(1);
    });
});

describe("createAccountStore", () => {
    test("fails fast when DATABASE_URL bootstrap breaks and fallback is disabled", async () => {
        const originalCreate = PostgresAccountStore.create;
        const postgresAccountStore = PostgresAccountStore as unknown as {
            create: typeof PostgresAccountStore.create;
        };
        postgresAccountStore.create = (async () => {
            throw new Error("postgres bootstrap failed");
        }) as typeof PostgresAccountStore.create;

        try {
            await expect(
                createAccountStore({
                    databaseUrl: "postgres://invalid",
                    jsonFilePath: makeTempFilePath("fallback-disabled"),
                    minPasswordLength: 8,
                }),
            ).rejects.toThrow("postgres bootstrap failed");
        } finally {
            postgresAccountStore.create = originalCreate;
        }
    });

    test("can explicitly fall back to JsonAccountStore when requested", async () => {
        const originalCreate = PostgresAccountStore.create;
        const postgresAccountStore = PostgresAccountStore as unknown as {
            create: typeof PostgresAccountStore.create;
        };
        postgresAccountStore.create = (async () => {
            throw new Error("postgres bootstrap failed");
        }) as typeof PostgresAccountStore.create;

        try {
            const store = await createAccountStore({
                databaseUrl: "postgres://invalid",
                jsonFilePath: makeTempFilePath("fallback-enabled"),
                minPasswordLength: 8,
                allowJsonFallbackOnDatabaseError: true,
            });

            expect(store).toBeInstanceOf(JsonAccountStore);
        } finally {
            postgresAccountStore.create = originalCreate;
        }
    });
});
