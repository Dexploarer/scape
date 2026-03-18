export interface TileHighlightStyle {
    slot: number;
    colorRgb?: number;
    thickness: number;
    alphaPercent: number;
    flags: number;
}

export interface TileHighlightRenderEntry {
    x: number;
    y: number;
    plane: number;
    colorRgb: number;
    fillAlpha: number;
    alwaysOnTop: boolean;
    thickness: number;
    flags: number;
    slot: number;
    group: number;
}

const SLOT_GROUP_SHIFT = 8;
const SLOT_GROUP_MASK = 0xff;
const ALWAYS_ON_TOP_FLAG = 0x10;

function makeSlotGroupKey(slot: number, group: number): number {
    return ((slot & 0xffff) << SLOT_GROUP_SHIFT) | (group & SLOT_GROUP_MASK);
}

function unpackTileCoord(coordPacked: number): { x: number; y: number; plane: number } | null {
    if (!Number.isFinite(coordPacked) || coordPacked < 0) {
        return null;
    }
    const packed = coordPacked | 0;
    return {
        plane: (packed >>> 28) & 0x3,
        x: (packed >>> 14) & 0x3fff,
        y: packed & 0x3fff,
    };
}

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value <= 0) {
        return 0;
    }
    if (value >= 100) {
        return 100;
    }
    return Math.floor(value);
}

export class TileHighlightManager {
    private readonly stylesBySlot = new Map<number, TileHighlightStyle>();
    private readonly coordsBySlotGroup = new Map<number, Set<number>>();
    private readonly renderEntries: TileHighlightRenderEntry[] = [];
    private dirty = true;

    configure(
        slot: number,
        colorRgb: number | undefined,
        thickness: number,
        alphaPercent: number,
        flags: number,
    ): void {
        const normalizedSlot = slot | 0;
        const normalizedColor =
            colorRgb === undefined ? undefined : (Math.floor(colorRgb) & 0xffffff) >>> 0;
        const next: TileHighlightStyle = {
            slot: normalizedSlot,
            colorRgb: normalizedColor,
            thickness: thickness | 0,
            alphaPercent: clampPercent(alphaPercent),
            flags: flags | 0,
        };
        const prev = this.stylesBySlot.get(normalizedSlot);
        if (
            prev &&
            prev.colorRgb === next.colorRgb &&
            prev.thickness === next.thickness &&
            prev.alphaPercent === next.alphaPercent &&
            prev.flags === next.flags
        ) {
            return;
        }
        this.stylesBySlot.set(normalizedSlot, next);
        this.dirty = true;
    }

    clear(slot: number): void {
        const normalizedSlot = slot | 0;
        let changed = false;
        for (const [slotGroupKey] of this.coordsBySlotGroup) {
            if (slotGroupKey >>> SLOT_GROUP_SHIFT !== normalizedSlot) {
                continue;
            }
            this.coordsBySlotGroup.delete(slotGroupKey);
            changed = true;
        }
        if (changed) {
            this.dirty = true;
        }
    }

    set(coordPacked: number, slot: number, group: number): void {
        if (!unpackTileCoord(coordPacked)) {
            return;
        }
        const key = makeSlotGroupKey(slot | 0, group | 0);
        let coords = this.coordsBySlotGroup.get(key);
        if (!coords) {
            coords = new Set<number>();
            this.coordsBySlotGroup.set(key, coords);
        }
        const normalizedCoord = coordPacked | 0;
        if (coords.has(normalizedCoord)) {
            return;
        }
        coords.add(normalizedCoord);
        this.dirty = true;
    }

    remove(coordPacked: number, slot: number, group: number): void {
        const key = makeSlotGroupKey(slot | 0, group | 0);
        const coords = this.coordsBySlotGroup.get(key);
        if (!coords) {
            return;
        }
        if (!coords.delete(coordPacked | 0)) {
            return;
        }
        if (coords.size === 0) {
            this.coordsBySlotGroup.delete(key);
        }
        this.dirty = true;
    }

    has(coordPacked: number, slot: number, group: number): boolean {
        const key = makeSlotGroupKey(slot | 0, group | 0);
        return this.coordsBySlotGroup.get(key)?.has(coordPacked | 0) ?? false;
    }

    hasRenderableSlot(slot: number): boolean {
        const normalizedSlot = slot | 0;
        const entries = this.getRenderEntries();
        for (let i = 0; i < entries.length; i++) {
            if ((entries[i]?.slot | 0) === normalizedSlot) {
                return true;
            }
        }
        return false;
    }

    getRenderEntries(): readonly TileHighlightRenderEntry[] {
        if (!this.dirty) {
            return this.renderEntries;
        }
        this.renderEntries.length = 0;
        for (const [slotGroupKey, coords] of this.coordsBySlotGroup) {
            if (coords.size === 0) {
                continue;
            }
            const slot = slotGroupKey >>> SLOT_GROUP_SHIFT;
            const style = this.stylesBySlot.get(slot);
            if (!style || style.colorRgb === undefined) {
                continue;
            }
            const group = slotGroupKey & SLOT_GROUP_MASK;
            const fillAlpha = style.alphaPercent / 100;
            const alwaysOnTop = (style.flags & ALWAYS_ON_TOP_FLAG) !== 0;
            for (const coordPacked of coords) {
                const coord = unpackTileCoord(coordPacked);
                if (!coord) {
                    continue;
                }
                this.renderEntries.push({
                    ...coord,
                    colorRgb: style.colorRgb,
                    fillAlpha,
                    alwaysOnTop,
                    thickness: style.thickness,
                    flags: style.flags,
                    slot,
                    group,
                });
            }
        }
        this.dirty = false;
        return this.renderEntries;
    }
}
