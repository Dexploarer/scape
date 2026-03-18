import type { ArchiveFile } from "../../cache/ArchiveFile";
import type { CacheSystem } from "../../cache/CacheSystem";
import { ConfigType } from "../../cache/ConfigType";
import { IndexType } from "../../cache/IndexType";
import type { DbRow } from "./DbRow";
import { loadDbRow } from "./DbRowLoader";
import type { DbTableDefinition } from "./DbTableDefinition";
import { loadDbTable } from "./DbTableLoader";

export class DbRepository {
    private tables?: Map<number, DbTableDefinition>;
    private rowsByTable?: Map<number, DbRow[]>;

    constructor(private readonly cacheSystem: CacheSystem) {}

    private ensureLoaded() {
        if (this.tables && this.rowsByTable) return;

        const tables = new Map<number, DbTableDefinition>();
        const rowsByTable = new Map<number, DbRow[]>();

        try {
            const configs = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            const dbTableArchive = configs.getArchive(ConfigType.OSRS.dbTable);
            if (dbTableArchive) {
                for (const file of dbTableArchive.files as ArchiveFile[]) {
                    const buffer = file.getDataAsBuffer();
                    const tableDef = loadDbTable(file.id, buffer);
                    tables.set(tableDef.id, tableDef);
                }
            }

            const dbRowArchive = configs.getArchive(ConfigType.OSRS.dbRow);
            if (dbRowArchive) {
                for (const file of dbRowArchive.files as ArchiveFile[]) {
                    const buffer = file.getDataAsBuffer();
                    const row = loadDbRow(file.id, buffer);
                    if (row.tableId >= 0) {
                        const list = rowsByTable.get(row.tableId) || [];
                        list.push(row);
                        rowsByTable.set(row.tableId, list);
                    }
                }
            }
        } catch (err) {
            console.error("DbRepository: failed to load", err);
        }

        this.tables = tables;
        this.rowsByTable = rowsByTable;
    }

    getTables(): Map<number, DbTableDefinition> {
        this.ensureLoaded();
        return this.tables ?? new Map();
    }

    getRows(tableId: number): DbRow[] {
        this.ensureLoaded();
        return this.rowsByTable?.get(tableId) ?? [];
    }

    findRows(predicate: (row: DbRow, table: DbTableDefinition | undefined) => boolean): DbRow[] {
        this.ensureLoaded();
        const result: DbRow[] = [];
        if (!this.rowsByTable) return result;
        for (const [tableId, rows] of this.rowsByTable.entries()) {
            const table = this.tables?.get(tableId);
            for (const row of rows) {
                if (predicate(row, table)) {
                    result.push(row);
                }
            }
        }
        return result;
    }

    /**
     * Look up a row by its ID directly (across all tables).
     * Used by DB_GETROWTABLE to find which table a row belongs to.
     */
    getRowById(rowId: number): DbRow | undefined {
        this.ensureLoaded();
        if (!this.rowsByTable) return undefined;
        for (const rows of this.rowsByTable.values()) {
            const row = rows.find((r) => r.id === rowId);
            if (row) return row;
        }
        return undefined;
    }
}
