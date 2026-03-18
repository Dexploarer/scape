/**
 * Binary Appearance Encoder
 *
 * Encodes player appearance block in OSRS binary format.
 * Reference: Player.read() in references/runescape-client/src/main/java/Player.java
 *
 * Binary format:
 * 1. gender (byte)
 * 2. headIconPk (byte) - skull icon
 * 3. headIconPrayer (byte) - prayer icon
 * 4. equipment array (12 slots, variable length)
 * 5. secondary equipment array (12 slots, for appearance overrides)
 * 6. body colors (5 bytes)
 * 7. Animation sequences (7 unsigned shorts): idle, turnLeft, walk, walkBack, walkLeft, walkRight, run
 * 8. username (null-terminated CP1252 string)
 * 9. combatLevel (byte)
 * 10. skillLevel (unsigned short)
 * 11. isHidden (byte)
 * 12. color/texture override flags (unsigned short)
 * 13. actions (3 null-terminated strings)
 * 14. final byte
 */
import type { PlayerAppearance } from "../../game/player";
import { encodeCp1252 } from "./Cp1252";
import type { PlayerAnimSet, PlayerViewSnapshot } from "./types";

// Equipment slot constants
const EQUIPMENT_SLOTS = 12;
const BODY_COLOR_COUNT = 5;

/**
 * Binary buffer writer for appearance encoding.
 */
class AppearanceWriter {
    private buffer: number[] = [];

    writeByte(value: number): void {
        this.buffer.push(value & 0xff);
    }

    writeUnsignedShort(value: number): void {
        this.buffer.push((value >> 8) & 0xff);
        this.buffer.push(value & 0xff);
    }

    writeStringCp1252NullTerminated(text: string): void {
        const bytes = encodeCp1252(text ?? "");
        for (const b of bytes) {
            this.buffer.push(b & 0xff);
        }
        this.buffer.push(0); // null terminator
    }

    toUint8Array(): Uint8Array {
        return Uint8Array.from(this.buffer);
    }
}

/**
 * Encode equipment slot value.
 * Returns [highByte, lowByte] or [0] if empty.
 *
 * OSRS format:
 * - 0: empty slot (single byte)
 * - 256-511: kit definition (body part), write 2 bytes
 * - >= 512: item definition (itemId + 512), write 2 bytes
 *
 * OSRS equipment slot order:
 * 0=head, 1=cape, 2=amulet, 3=weapon, 4=body, 5=shield,
 * 6=arms, 7=legs, 8=hair, 9=hands, 10=feet, 11=beard
 */
function encodeEquipmentSlot(
    slot: number,
    equip: number[] | undefined,
    kits: number[] | undefined,
): number[] {
    const equipValue = equip?.[slot] ?? -1;

    // Check if item is equipped
    if (equipValue >= 0) {
        // Item equipped: value = itemId + 512
        const value = equipValue + 512;
        return [(value >> 8) & 0xff, value & 0xff];
    }

    // No item - check for kit (body part)
    // Kit indices in server data: 0=head, 1=body/torso, 2=arms, 3=legs, 4=hands, 5=feet, 6=hair, 7=beard
    // Equipment slot to kit index mapping
    const kitSlotMap: Record<number, number> = {
        0: 0, // head equipment slot -> kit index 0 (head)
        4: 1, // body equipment slot -> kit index 1 (torso)
        6: 2, // arms equipment slot -> kit index 2 (arms)
        7: 3, // legs equipment slot -> kit index 3 (legs)
        9: 4, // hands equipment slot -> kit index 4 (hands)
        10: 5, // feet equipment slot -> kit index 5 (feet)
        8: 6, // hair equipment slot -> kit index 6 (hair)
        11: 7, // beard equipment slot -> kit index 7 (beard)
    };

    const kitIndex = kitSlotMap[slot];
    if (kitIndex !== undefined && kits && kits[kitIndex] !== undefined && kits[kitIndex] >= 0) {
        // Kit: value = kitId + 256
        const value = kits[kitIndex] + 256;
        return [(value >> 8) & 0xff, value & 0xff];
    }

    // Empty slot - slots like cape, amulet, weapon, shield have no kit fallback
    return [0];
}

/**
 * Encode animation sequence value.
 * OSRS uses 65535 to represent -1 (no animation).
 */
function encodeAnimSequence(value: number | undefined): number {
    if (value === undefined || value < 0) {
        return 65535;
    }
    return value & 0xffff;
}

/**
 * Encode player appearance to OSRS binary format.
 */
export function encodeAppearanceBinary(
    view: PlayerViewSnapshot,
    options?: {
        combatLevel?: number;
        skillLevel?: number;
        isHidden?: boolean;
        actions?: [string, string, string];
    },
): Uint8Array {
    const writer = new AppearanceWriter();
    const appearance = view.appearance;
    const anim = view.anim;

    // 1. Gender (byte)
    const gender = appearance?.gender ?? 0;
    writer.writeByte(gender);

    // 2. headIconPk - skull (byte)
    const skull = appearance?.headIcons?.skull ?? -1;
    writer.writeByte(skull);

    // 3. headIconPrayer (byte)
    const prayer = appearance?.headIcons?.prayer ?? -1;
    writer.writeByte(prayer);

    // 4. Equipment array (12 slots)
    // OSRS slot order: head, cape, amulet, weapon, body, shield, arms, legs, hair, hands, feet, beard
    for (let slot = 0; slot < EQUIPMENT_SLOTS; slot++) {
        const bytes = encodeEquipmentSlot(slot, appearance?.equip, appearance?.kits);
        for (const b of bytes) {
            writer.writeByte(b);
        }
    }

    // 5. Secondary equipment array (12 slots) - for appearance overrides
    // In most cases this mirrors the primary array or is empty
    for (let slot = 0; slot < EQUIPMENT_SLOTS; slot++) {
        const bytes = encodeEquipmentSlot(slot, appearance?.equip, appearance?.kits);
        for (const b of bytes) {
            writer.writeByte(b);
        }
    }

    // 6. Body colors (5 bytes)
    const colors = appearance?.colors ?? [0, 0, 0, 0, 0];
    for (let i = 0; i < BODY_COLOR_COUNT; i++) {
        writer.writeByte(colors[i] ?? 0);
    }

    // 7. Animation sequences (7 unsigned shorts)
    // OSRS order: idle, turnLeft, walk, walkBack, walkLeft, walkRight, run
    // Note: turnRight = turnLeft (copied on client, not sent separately)
    writer.writeUnsignedShort(encodeAnimSequence(anim?.idle)); // idle
    writer.writeUnsignedShort(encodeAnimSequence(anim?.turnLeft)); // turnLeft
    writer.writeUnsignedShort(encodeAnimSequence(anim?.walk)); // walk
    writer.writeUnsignedShort(encodeAnimSequence(anim?.walkBack)); // walkBack
    writer.writeUnsignedShort(encodeAnimSequence(anim?.walkLeft)); // walkLeft
    writer.writeUnsignedShort(encodeAnimSequence(anim?.walkRight)); // walkRight
    writer.writeUnsignedShort(encodeAnimSequence(anim?.run)); // run

    // 8. Username (null-terminated CP1252 string)
    writer.writeStringCp1252NullTerminated(view.name ?? "");

    // 9. Combat level (byte)
    writer.writeByte(options?.combatLevel ?? 3);

    // 10. Skill level (unsigned short) - total level for display
    writer.writeUnsignedShort(options?.skillLevel ?? 32);

    // 11. isHidden (byte)
    writer.writeByte(options?.isHidden ? 1 : 0);

    // 12. Color/texture override flags (unsigned short)
    // 0 = no overrides
    writer.writeUnsignedShort(0);

    // 13. Actions (3 null-terminated strings)
    const actions = options?.actions ?? ["", "", ""];
    writer.writeStringCp1252NullTerminated(actions[0] ?? "");
    writer.writeStringCp1252NullTerminated(actions[1] ?? "");
    writer.writeStringCp1252NullTerminated(actions[2] ?? "");

    // 14. Final byte (appearance flags)
    writer.writeByte(0);

    return writer.toUint8Array();
}
