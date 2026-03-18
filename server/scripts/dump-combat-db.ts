import { DbRepository } from "../../src/rs/config/db/DbRepository";
import { initCacheEnv } from "../src/world/CacheEnv";

const COMBAT_DB_TABLE_ID = 78;

function main() {
    const env = initCacheEnv("caches");
    const dbRepo = new DbRepository(env.cacheSystem);
    const rows = dbRepo.getRows(COMBAT_DB_TABLE_ID);

    console.log(`DB Table ${COMBAT_DB_TABLE_ID} has ${rows.length} rows\n`);

    for (const row of rows) {
        const idColumn = row.columns.get(0);
        const buttonsColumn = row.columns.get(1);

        if (!idColumn || !buttonsColumn) continue;

        const categoryId = idColumn.values?.[0] as number | undefined;
        if (categoryId === undefined || !Number.isFinite(categoryId)) continue;

        console.log(`=== Combat Category ${categoryId} ===`);

        const stride = buttonsColumn.types.length;
        console.log(`Stride: ${stride}`);

        for (let idx = 0; idx < buttonsColumn.values.length; idx += stride) {
            const slotValue = buttonsColumn.values[idx] as number | undefined;
            const slot = Number.isFinite(slotValue) ? slotValue : idx / stride;
            const label = String(buttonsColumn.values[idx + 1] ?? "");
            const tooltip = String(buttonsColumn.values[idx + 2] ?? "");
            const extra = stride > 3 ? String(buttonsColumn.values[idx + 3] ?? "") : "";

            console.log(
                `  Slot ${slot}: label="${label}" tooltip="${tooltip}" ${
                    extra ? `extra="${extra}"` : ""
                }`,
            );
        }
        console.log("");
    }
}

main();
