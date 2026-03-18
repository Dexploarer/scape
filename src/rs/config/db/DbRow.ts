import type { ScriptVarTypeId } from "./ScriptVarType";

export type DbColumnValueSet = {
    columnId: number;
    types: ScriptVarTypeId[];
    values: any[];
};

export class DbRow {
    tableId = -1;
    readonly columns = new Map<number, DbColumnValueSet>();

    constructor(readonly id: number) {}

    setColumn(valueSet: DbColumnValueSet) {
        this.columns.set(valueSet.columnId, valueSet);
    }

    getColumn(columnId: number): DbColumnValueSet | undefined {
        return this.columns.get(columnId);
    }
}
