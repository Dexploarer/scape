import collectionLogData from "./collection-log.json";

type CollectionLogCategoryData = {
    tabIndex: number;
    categoryIndex: number;
    structId: number;
    name: string;
    itemsEnumId: number;
    itemIds: number[];
};

type CollectionLogData = {
    categories: CollectionLogCategoryData[];
};

const PARAM_CATEGORY_ENUM = 683;
const PARAM_CATEGORY_NAME = 689;
const PARAM_CATEGORY_ITEMS_ENUM = 690;
const TAB_STRUCT_IDS = [471, 472, 473, 474, 475] as const;
const TAB_ITEMS_ENUM_IDS = [2103, 2104, 2105, 2106, 2107] as const;

const enumIntOverrides = new Map<number, number[]>();
const structParamOverrides = new Map<number, Map<number, number | string>>();

function toInt(value: unknown): number {
    return Number(value) | 0;
}

function toPositiveIntArray(input: unknown): number[] {
    if (!Array.isArray(input)) return [];
    return input
        .map((value) => toInt(value))
        .filter((value) => Number.isFinite(value) && value > 0);
}

function setStructParamOverride(structId: number, paramId: number, value: number | string): void {
    const sid = structId | 0;
    if (sid <= 0) return;
    let params = structParamOverrides.get(sid);
    if (!params) {
        params = new Map<number, number | string>();
        structParamOverrides.set(sid, params);
    }
    params.set(paramId | 0, value);
}

function setEnumOverride(enumId: number, values: number[]): void {
    const eid = enumId | 0;
    if (eid <= 0) return;
    enumIntOverrides.set(
        eid,
        values.map((value) => value | 0),
    );
}

function initialize(): void {
    const data = collectionLogData as CollectionLogData;
    const categories = Array.isArray(data.categories) ? data.categories : [];
    // Category entries are the source of truth; tab enum overrides are rebuilt from them.
    const tabCategories = new Map<
        number,
        Array<{ categoryIndex: number; structId: number; order: number }>
    >();

    for (let order = 0; order < categories.length; order++) {
        const category = categories[order];
        const structId = toInt(category.structId);
        const tabIndex = toInt(category.tabIndex);
        const categoryIndex = toInt(category.categoryIndex);
        const itemsEnumId = toInt(category.itemsEnumId);
        const itemIds = toPositiveIntArray(category.itemIds);
        const categoryName = String(category.name ?? "");
        if (structId <= 0 || tabIndex < 0 || tabIndex >= TAB_STRUCT_IDS.length) continue;

        let bucket = tabCategories.get(tabIndex);
        if (!bucket) {
            bucket = [];
            tabCategories.set(tabIndex, bucket);
        }
        bucket.push({
            categoryIndex: categoryIndex >= 0 ? categoryIndex : bucket.length,
            structId,
            order,
        });

        if (categoryName.length > 0) {
            setStructParamOverride(structId, PARAM_CATEGORY_NAME, categoryName);
        }
        if (itemsEnumId > 0) {
            setStructParamOverride(structId, PARAM_CATEGORY_ITEMS_ENUM, itemsEnumId);
            setEnumOverride(itemsEnumId, itemIds);
        }
    }

    for (let tabIndex = 0; tabIndex < TAB_STRUCT_IDS.length; tabIndex++) {
        const tabStructId = TAB_STRUCT_IDS[tabIndex] | 0;
        const tabItemsEnumId = TAB_ITEMS_ENUM_IDS[tabIndex] | 0;
        const bucket = tabCategories.get(tabIndex) ?? [];
        const categoryStructIds = bucket
            .sort((a, b) => {
                const indexDelta = (a.categoryIndex | 0) - (b.categoryIndex | 0);
                return indexDelta !== 0 ? indexDelta : (a.order | 0) - (b.order | 0);
            })
            .map((entry) => entry.structId | 0)
            .filter((value) => value > 0);

        setStructParamOverride(tabStructId, PARAM_CATEGORY_ENUM, tabItemsEnumId);
        setEnumOverride(tabItemsEnumId, categoryStructIds);
    }
}

initialize();

export function getCollectionLogStructParamOverride(
    structId: number,
    paramId: number,
): number | string | undefined {
    return structParamOverrides.get(structId | 0)?.get(paramId | 0);
}

export function getCollectionLogEnumCountOverride(enumId: number): number | undefined {
    const values = enumIntOverrides.get(enumId | 0);
    return values ? values.length | 0 : undefined;
}

export function getCollectionLogEnumValueOverride(enumId: number, key: number): number | undefined {
    const values = enumIntOverrides.get(enumId | 0);
    if (!values) return undefined;
    const idx = key | 0;
    if (idx < 0 || idx >= values.length) return -1;
    return values[idx] | 0;
}
