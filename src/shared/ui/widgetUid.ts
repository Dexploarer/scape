/**
 * Shared widget UID helpers.
 *
 * OSRS widget/component UIDs are packed as: (groupId << 16) | childId
 */
export function packWidgetUid(groupId: number, childId: number): number {
    return ((groupId & 0xffff) << 16) | (childId & 0xffff);
}
