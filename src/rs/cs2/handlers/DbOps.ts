/**
 * Database operations
 */
import { isReferenceType, isStringType } from "../../config/db/ScriptVarType";
import { Opcodes } from "../Opcodes";
import type { HandlerMap } from "./HandlerTypes";

/**
 * Helper to get the effective value for a column in a row, considering table defaults.
 * Returns the explicit value if present, or the table default if not.
 */
function getEffectiveColumnValue(
    ctx: any,
    tableId: number,
    columnId: number,
    row: any,
): { found: boolean; values: any[] } {
    // First check if row has explicit column data
    const col = row.getColumn(columnId);
    if (col && col.values && col.values.length > 0) {
        return { found: true, values: col.values };
    }

    // Fall back to table default values
    if (ctx.dbRepository) {
        const tables = ctx.dbRepository.getTables();
        const tableDef = tables.get(tableId);
        if (tableDef) {
            const colDef = tableDef.getColumn(columnId);
            if (colDef && colDef.defaultValues && colDef.defaultValues.length > 0) {
                return { found: true, values: colDef.defaultValues };
            }
        }
    }

    return { found: false, values: [] };
}

export function registerDbOps(handlers: HandlerMap): void {
    handlers.set(Opcodes.DB_FIND_WITH_COUNT, (ctx) => {
        const isString = ctx.intStack[--ctx.intStackSize] === 2;
        let query: string | number;
        if (isString) {
            query = ctx.stringStack[--ctx.stringStackSize];
        } else {
            query = ctx.intStack[--ctx.intStackSize];
        }
        const tableColumnPacked = ctx.intStack[--ctx.intStackSize];

        const tableId = (tableColumnPacked >> 12) & 0xffff;
        const columnId = (tableColumnPacked >> 4) & 0x7f;

        const rowQuery: number[] = [];

        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            for (const row of rows) {
                // Get effective value (explicit or default)
                const { found, values } = getEffectiveColumnValue(ctx, tableId, columnId, row);
                if (found) {
                    for (const val of values) {
                        // Compare with type coercion for booleans:
                        // OSRS treats false as 0 and true as 1
                        const normalizedVal = typeof val === "boolean" ? (val ? 1 : 0) : val;
                        if (normalizedVal === query) {
                            rowQuery.push(row.id);
                            break;
                        }
                    }
                }
            }
        } else {
            console.warn(`[DB_FIND] No dbRepository available!`);
        }

        ctx.setDbRowQuery(rowQuery);
        ctx.setDbRowIndex(-1);
        ctx.setDbTableId(tableId);
        ctx.pushInt(rowQuery.length);
    });

    handlers.set(Opcodes.DB_FIND, (ctx) => {
        const isString = ctx.intStack[--ctx.intStackSize] === 2;
        let query: string | number;
        if (isString) {
            query = ctx.stringStack[--ctx.stringStackSize];
        } else {
            query = ctx.intStack[--ctx.intStackSize];
        }
        const tableColumnPacked = ctx.intStack[--ctx.intStackSize];

        const tableId = (tableColumnPacked >> 12) & 0xffff;
        const columnId = (tableColumnPacked >> 4) & 0x7f;

        const rowQuery: number[] = [];

        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            for (const row of rows) {
                // Get effective value (explicit or default)
                const { found, values } = getEffectiveColumnValue(ctx, tableId, columnId, row);
                if (found) {
                    for (const val of values) {
                        // Compare with type coercion for booleans
                        const normalizedVal = typeof val === "boolean" ? (val ? 1 : 0) : val;
                        if (normalizedVal === query) {
                            rowQuery.push(row.id);
                            break;
                        }
                    }
                }
            }
        }

        ctx.setDbRowQuery(rowQuery);
        ctx.setDbRowIndex(-1);
        ctx.setDbTableId(tableId);
    });

    handlers.set(Opcodes.DB_FINDNEXT, (ctx) => {
        ctx.setDbRowIndex(ctx.dbRowIndex + 1);
        if (ctx.dbRowIndex < ctx.dbRowQuery.length) {
            ctx.pushInt(ctx.dbRowQuery[ctx.dbRowIndex]);
        } else {
            ctx.pushInt(-1);
        }
    });

    handlers.set(Opcodes.DB_GETFIELD, (ctx) => {
        const subIndex = ctx.intStack[--ctx.intStackSize];
        const tableColumnPacked = ctx.intStack[--ctx.intStackSize];
        const rowId = ctx.intStack[--ctx.intStackSize];

        const tableId = (tableColumnPacked >> 12) & 0xffff;
        const columnId = (tableColumnPacked >> 4) & 0x7f;

        let resultCount = 0;
        let colTypes: number[] = [];

        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            const row = rows.find((r) => r.id === rowId);

            if (row) {
                const col = row.getColumn(columnId);
                if (col && col.values && col.types.length > 0) {
                    colTypes = col.types;
                    const tupleSize = col.types.length;
                    const startIdx = subIndex * tupleSize;

                    // Check if this tuple exists
                    if (startIdx + tupleSize <= col.values.length) {
                        // Push all values in the tuple (in order - first type goes first on stack)
                        for (let i = 0; i < tupleSize; i++) {
                            const val = col.values[startIdx + i];
                            const type = col.types[i];

                            if (isStringType(type)) {
                                ctx.pushString(typeof val === "string" ? val : "");
                            } else {
                                ctx.pushInt(typeof val === "number" ? val : 0);
                            }
                        }
                        resultCount = tupleSize;
                    }
                }
            }
        }

        // If no results pushed, get column types and default values from table definition
        if (resultCount === 0) {
            let defaultValues: any[] | undefined;

            if (ctx.dbRepository) {
                const tables = ctx.dbRepository.getTables();
                const tableDef = tables.get(tableId);
                if (tableDef) {
                    const colDef = tableDef.getColumn(columnId);
                    if (colDef && colDef.types.length > 0) {
                        colTypes = colDef.types;
                        defaultValues = colDef.defaultValues;
                    }
                }
            }

            // Use table's default values if available, otherwise push generic defaults
            if (defaultValues && defaultValues.length > 0) {
                const tupleSize = colTypes.length;
                const startIdx = subIndex * tupleSize;

                if (startIdx + tupleSize <= defaultValues.length) {
                    for (let i = 0; i < tupleSize; i++) {
                        const val = defaultValues[startIdx + i];
                        const type = colTypes[i];
                        if (isStringType(type)) {
                            ctx.pushString(typeof val === "string" ? val : "");
                        } else {
                            ctx.pushInt(typeof val === "number" ? val : 0);
                        }
                    }
                } else {
                    // Default values exist but not enough for this subIndex
                    for (const type of colTypes) {
                        if (isStringType(type)) {
                            ctx.pushString("");
                        } else {
                            ctx.pushInt(0);
                        }
                    }
                }
            } else {
                // No default values defined, push generic defaults
                // Reference types (DBROW, OBJ, NPC, etc.) default to -1 (null)
                // Other integers default to 0
                for (const type of colTypes) {
                    if (isStringType(type)) {
                        ctx.pushString("");
                    } else if (isReferenceType(type)) {
                        ctx.pushInt(-1); // Null reference
                    } else {
                        ctx.pushInt(0);
                    }
                }

                // If still nothing pushed (no type info), push one int as fallback
                if (colTypes.length === 0) {
                    ctx.pushInt(0);
                }
            }
        }
    });

    handlers.set(Opcodes.DB_GETFIELDCOUNT, (ctx) => {
        const tableColumnPacked = ctx.intStack[--ctx.intStackSize];
        const rowId = ctx.intStack[--ctx.intStackSize];

        const tableId = (tableColumnPacked >> 12) & 0xffff;
        const columnId = (tableColumnPacked >> 4) & 0x7f;

        let count = 0;

        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            const row = rows.find((r) => r.id === rowId);
            if (row) {
                const col = row.getColumn(columnId);
                if (col && col.values && col.types.length > 0) {
                    // Return number of tuples, not total values
                    // Each tuple has col.types.length values
                    count = Math.floor(col.values.length / col.types.length);
                }
            }
        }

        ctx.pushInt(count);
    });

    handlers.set(Opcodes.DB_FINDALL_WITH_COUNT, (ctx) => {
        const tableId = ctx.intStack[--ctx.intStackSize];

        const rowQuery: number[] = [];

        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            for (const row of rows) {
                rowQuery.push(row.id);
            }
        }

        ctx.setDbRowQuery(rowQuery);
        ctx.setDbRowIndex(-1);
        ctx.setDbTableId(tableId);
        ctx.pushInt(rowQuery.length);
    });

    // DB_FINDALL (7509) - Filter existing query by column value (no count push)
    // Note: Despite the name, this filters an existing query rather than getting all rows
    handlers.set(Opcodes.DB_FINDALL, (ctx) => {
        const isString = ctx.intStack[--ctx.intStackSize] === 2;
        let query: string | number;
        if (isString) {
            query = ctx.stringStack[--ctx.stringStackSize];
        } else {
            query = ctx.intStack[--ctx.intStackSize];
        }
        const tableColumnPacked = ctx.intStack[--ctx.intStackSize];

        const tableId = (tableColumnPacked >> 12) & 0xffff;
        const columnId = (tableColumnPacked >> 4) & 0x7f;

        // Verify table matches current query
        if (tableId !== ctx.dbTableId) {
            // Table mismatch - clear query
            ctx.setDbRowQuery([]);
            ctx.setDbRowIndex(-1);
            return;
        }

        // Find rows matching query value in the specified column
        const matchingRowIds = new Set<number>();
        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            for (const row of rows) {
                // Get effective value (explicit or default)
                const { found, values } = getEffectiveColumnValue(ctx, tableId, columnId, row);
                if (found) {
                    for (const val of values) {
                        // Compare with type coercion for booleans
                        const normalizedVal = typeof val === "boolean" ? (val ? 1 : 0) : val;
                        if (normalizedVal === query) {
                            matchingRowIds.add(row.id);
                            break;
                        }
                    }
                }
            }
        }

        // Intersect with existing query (filter down to matching rows)
        const filtered = ctx.dbRowQuery.filter((id) => matchingRowIds.has(id));
        ctx.setDbRowQuery(filtered);
        ctx.setDbRowIndex(-1);
    });

    handlers.set(Opcodes.DB_GETROWTABLE, (ctx) => {
        const rowId = ctx.intStack[--ctx.intStackSize];
        // Look up the row and return its table ID
        if (ctx.dbRepository) {
            const row = ctx.dbRepository.getRowById(rowId);
            if (row) {
                ctx.pushInt(row.tableId);
                return;
            }
        }
        // Fallback: return -1 if row not found
        ctx.pushInt(-1);
    });

    handlers.set(Opcodes.DB_GETROW, (ctx) => {
        // Pop index from stack and return the row at that index in the query
        const index = ctx.intStack[--ctx.intStackSize];
        if (index >= 0 && index < ctx.dbRowQuery.length) {
            ctx.pushInt(ctx.dbRowQuery[index]);
        } else {
            ctx.pushInt(-1);
        }
    });

    // DB_FIND_FILTER_WITH_COUNT (7507) - Filter existing query by column value, push count
    // This filters an existing query (started by DB_FIND, DB_FINDALL_WITH_COUNT, etc.)
    handlers.set(Opcodes.DB_FIND_FILTER_WITH_COUNT, (ctx) => {
        const isString = ctx.intStack[--ctx.intStackSize] === 2;
        let query: string | number;
        if (isString) {
            query = ctx.stringStack[--ctx.stringStackSize];
        } else {
            query = ctx.intStack[--ctx.intStackSize];
        }
        const tableColumnPacked = ctx.intStack[--ctx.intStackSize];

        const tableId = (tableColumnPacked >> 12) & 0xffff;
        const columnId = (tableColumnPacked >> 4) & 0x7f;

        // Verify table matches current query
        if (tableId !== ctx.dbTableId) {
            // Table mismatch - clear query
            ctx.setDbRowQuery([]);
            ctx.setDbRowIndex(-1);
            ctx.pushInt(0);
            return;
        }

        // Find rows matching query value in the specified column
        const matchingRowIds = new Set<number>();
        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            for (const row of rows) {
                // Get effective value (explicit or default)
                const { found, values } = getEffectiveColumnValue(ctx, tableId, columnId, row);
                if (found) {
                    for (const val of values) {
                        // Compare with type coercion for booleans
                        const normalizedVal = typeof val === "boolean" ? (val ? 1 : 0) : val;
                        if (normalizedVal === query) {
                            matchingRowIds.add(row.id);
                            break;
                        }
                    }
                }
            }
        }

        // Intersect with existing query (filter down to matching rows)
        const filtered = ctx.dbRowQuery.filter((id) => matchingRowIds.has(id));
        ctx.setDbRowQuery(filtered);
        ctx.setDbRowIndex(-1);
        ctx.pushInt(filtered.length);
    });

    // DB_FIND_FILTER (7510) - Get all rows from a table, initialize query (no count push)
    // Note: Despite the name suggesting filtering, this actually initializes a query with all rows
    handlers.set(Opcodes.DB_FIND_FILTER, (ctx) => {
        const tableId = ctx.intStack[--ctx.intStackSize];

        const rowQuery: number[] = [];

        if (ctx.dbRepository) {
            const rows = ctx.dbRepository.getRows(tableId);
            for (const row of rows) {
                rowQuery.push(row.id);
            }
        }

        ctx.setDbRowQuery(rowQuery);
        ctx.setDbRowIndex(-1);
        ctx.setDbTableId(tableId);
    });
}
