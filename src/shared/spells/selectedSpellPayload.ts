export interface SelectedSpellPayloadFields {
    selectedSpellWidgetId?: number;
    spellbookGroupId?: number;
    widgetChildId?: number;
    selectedSpellChildIndex?: number;
    selectedSpellItemId?: number;
}

export interface NormalizedSelectedSpellPayload extends SelectedSpellPayloadFields {
    selectedSpellWidgetId: number;
    spellbookGroupId: number;
    widgetChildId: number;
    selectedSpellChildIndex: number;
    selectedSpellItemId: number;
}

export function buildSelectedSpellPayload(
    selectedSpellWidgetIdRaw: number,
    selectedSpellChildIndexRaw?: number,
    selectedSpellItemIdRaw?: number,
): NormalizedSelectedSpellPayload | undefined {
    const selectedSpellWidgetId = selectedSpellWidgetIdRaw | 0;
    if (!(selectedSpellWidgetId > 0)) {
        return undefined;
    }

    const fallbackChildIndex = selectedSpellWidgetId & 0xffff;
    const selectedSpellChildIndex =
        Number.isFinite(selectedSpellChildIndexRaw) && (selectedSpellChildIndexRaw as number) >= 0
            ? (selectedSpellChildIndexRaw as number) | 0
            : fallbackChildIndex;
    const selectedSpellItemId =
        Number.isFinite(selectedSpellItemIdRaw) && (selectedSpellItemIdRaw as number) >= 0
            ? (selectedSpellItemIdRaw as number) | 0
            : -1;

    return {
        selectedSpellWidgetId,
        spellbookGroupId: (selectedSpellWidgetId >>> 16) & 0xffff,
        widgetChildId: selectedSpellChildIndex,
        selectedSpellChildIndex,
        selectedSpellItemId,
    };
}

export function resolveSelectedSpellPayload(
    payload: SelectedSpellPayloadFields,
): SelectedSpellPayloadFields {
    const selectedSpellWidgetId =
        Number.isFinite(payload.selectedSpellWidgetId) &&
        (payload.selectedSpellWidgetId as number) > 0
            ? (payload.selectedSpellWidgetId as number) | 0
            : undefined;
    const fallbackChildIndex =
        selectedSpellWidgetId !== undefined ? selectedSpellWidgetId & 0xffff : undefined;
    const selectedSpellChildIndex =
        Number.isFinite(payload.selectedSpellChildIndex) &&
        (payload.selectedSpellChildIndex as number) >= 0
            ? (payload.selectedSpellChildIndex as number) | 0
            : fallbackChildIndex;
    const widgetChildId =
        selectedSpellChildIndex ??
        (Number.isFinite(payload.widgetChildId) && (payload.widgetChildId as number) >= 0
            ? (payload.widgetChildId as number) | 0
            : undefined);
    const spellbookGroupId =
        selectedSpellWidgetId !== undefined
            ? (selectedSpellWidgetId >>> 16) & 0xffff
            : Number.isFinite(payload.spellbookGroupId) && (payload.spellbookGroupId as number) >= 0
            ? (payload.spellbookGroupId as number) | 0
            : undefined;
    const selectedSpellItemId =
        Number.isFinite(payload.selectedSpellItemId) && (payload.selectedSpellItemId as number) >= 0
            ? (payload.selectedSpellItemId as number) | 0
            : undefined;

    return {
        selectedSpellWidgetId,
        spellbookGroupId,
        widgetChildId,
        selectedSpellChildIndex,
        selectedSpellItemId,
    };
}
