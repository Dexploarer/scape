export type WidgetRoles = {
    listFileId?: number;
    scrollFileId?: number;
};

// Central registry of known child roles for specific interface groups.
// Keep this small and explicit — no heuristics.
const ROLES: Record<number, WidgetRoles> = {
    // Friends Chat (group 7): list under #12, scrollbar under #13
    7: { listFileId: 12, scrollFileId: 13 },
    // Bank (group 12): list under #13, scrollbar under #14
    12: { listFileId: 13, scrollFileId: 14 },
    // Deathkeep (group 4): left pane list under #5, scrollbar track under #11
    4: { listFileId: 5, scrollFileId: 11 },
};

export function getWidgetRoles(groupId: number): WidgetRoles | undefined {
    return ROLES[groupId >>> 0];
}
