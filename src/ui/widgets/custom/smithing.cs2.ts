import {
    SMITHING_BAR_MODAL_COMPONENT_ADAMANT,
    SMITHING_BAR_MODAL_COMPONENT_ADAMANT_ICON,
    SMITHING_BAR_MODAL_COMPONENT_ADAMANT_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_BODY,
    SMITHING_BAR_MODAL_COMPONENT_BRONZE,
    SMITHING_BAR_MODAL_COMPONENT_BRONZE_ICON,
    SMITHING_BAR_MODAL_COMPONENT_BRONZE_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_CLOSE,
    SMITHING_BAR_MODAL_COMPONENT_CURRENT,
    SMITHING_BAR_MODAL_COMPONENT_FRAME,
    SMITHING_BAR_MODAL_COMPONENT_IRON,
    SMITHING_BAR_MODAL_COMPONENT_IRON_ICON,
    SMITHING_BAR_MODAL_COMPONENT_IRON_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_LOVAKITE,
    SMITHING_BAR_MODAL_COMPONENT_LOVAKITE_ICON,
    SMITHING_BAR_MODAL_COMPONENT_LOVAKITE_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_MITHRIL,
    SMITHING_BAR_MODAL_COMPONENT_MITHRIL_ICON,
    SMITHING_BAR_MODAL_COMPONENT_MITHRIL_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_ROOT,
    SMITHING_BAR_MODAL_COMPONENT_RUNE,
    SMITHING_BAR_MODAL_COMPONENT_RUNE_ICON,
    SMITHING_BAR_MODAL_COMPONENT_RUNE_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_STEEL,
    SMITHING_BAR_MODAL_COMPONENT_STEEL_ICON,
    SMITHING_BAR_MODAL_COMPONENT_STEEL_TEXT,
    SMITHING_BAR_MODAL_COMPONENT_TITLE,
    SMITHING_BAR_MODAL_GROUP_ID,
} from "../../../shared/ui/widgets";
import { FONT_BOLD_12, FONT_PLAIN_11 } from "../../fonts";
import { FLAG_TRANSMIT_OP1 } from "../WidgetFlags";
import type { WidgetNode } from "../WidgetNode";

export type WidgetGroupLoadResult = {
    root: WidgetNode | undefined;
    widgets: Map<number, WidgetNode>;
};

function smithingBarModalUid(componentId: number): number {
    return ((SMITHING_BAR_MODAL_GROUP_ID & 0xffff) << 16) | (componentId & 0xffff);
}

function smithingBarWidget(
    componentId: number,
    parentUid: number,
    overrides: Partial<WidgetNode>,
): WidgetNode {
    const uid = smithingBarModalUid(componentId);
    return {
        uid,
        id: uid,
        childIndex: -1,
        parentUid,
        groupId: SMITHING_BAR_MODAL_GROUP_ID,
        fileId: componentId | 0,
        isIf3: true,
        type: 0,
        contentType: 0,
        rawX: 0,
        rawY: 0,
        rawWidth: 0,
        rawHeight: 0,
        widthMode: 0,
        heightMode: 0,
        xPositionMode: 0,
        yPositionMode: 0,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        scrollX: 0,
        scrollY: 0,
        scrollWidth: 0,
        scrollHeight: 0,
        isHidden: false,
        hidden: false,
        cachedHidden: false,
        rootIndex: -1,
        cycle: -1,
        modelFrame: 0,
        modelFrameCycle: 0,
        aspectWidth: 1,
        aspectHeight: 1,
        itemId: -1,
        itemQuantity: 0,
        ...overrides,
    };
}

export function buildSmithingBarModalGroup(): WidgetGroupLoadResult {
    const widgets = new Map<number, WidgetNode>();
    const rootUid = smithingBarModalUid(SMITHING_BAR_MODAL_COMPONENT_ROOT);

    const root = smithingBarWidget(SMITHING_BAR_MODAL_COMPONENT_ROOT, -1, {
        type: 0,
        rawX: 0,
        rawY: 0,
        rawWidth: 18,
        rawHeight: 18,
        widthMode: 1,
        heightMode: 1,
        width: 500,
        height: 320,
        scrollWidth: 0,
        scrollHeight: 0,
        xPositionMode: 1,
        yPositionMode: 1,
    });
    widgets.set(root.uid, root);

    const frame = smithingBarWidget(SMITHING_BAR_MODAL_COMPONENT_FRAME, rootUid, {
        type: 0,
        rawX: 0,
        rawY: 0,
        rawWidth: 0,
        rawHeight: 0,
        widthMode: 1,
        heightMode: 1,
        width: 500,
        height: 320,
        scrollWidth: 0,
        scrollHeight: 0,
    });
    widgets.set(frame.uid, frame);

    const title = smithingBarWidget(SMITHING_BAR_MODAL_COMPONENT_TITLE, rootUid, {
        type: 4,
        rawX: 34,
        rawY: 62,
        rawWidth: 68,
        rawHeight: 20,
        widthMode: 1,
        width: 432,
        height: 20,
        text: "",
        fontId: FONT_BOLD_12,
        textColor: 0xffd27f,
        textShadowed: true,
        xTextAlignment: 1,
        yTextAlignment: 1,
    });
    widgets.set(title.uid, title);

    const body = smithingBarWidget(SMITHING_BAR_MODAL_COMPONENT_BODY, rootUid, {
        type: 4,
        rawX: 34,
        rawY: 84,
        rawWidth: 68,
        rawHeight: 16,
        widthMode: 1,
        width: 432,
        height: 16,
        text: "",
        fontId: FONT_PLAIN_11,
        textColor: 0xe8ded0,
        textShadowed: true,
        xTextAlignment: 1,
        yTextAlignment: 1,
        lineHeight: 14,
    });
    widgets.set(body.uid, body);

    const current = smithingBarWidget(SMITHING_BAR_MODAL_COMPONENT_CURRENT, rootUid, {
        type: 4,
        rawX: 34,
        rawY: 252,
        rawWidth: 68,
        rawHeight: 16,
        widthMode: 1,
        width: 432,
        height: 16,
        text: "",
        fontId: FONT_PLAIN_11,
        textColor: 0xc5b79b,
        textShadowed: true,
        xTextAlignment: 1,
        yTextAlignment: 1,
        isHidden: true,
        hidden: true,
    });
    widgets.set(current.uid, current);

    const buttonDefs = [
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_BRONZE,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_BRONZE_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_BRONZE_TEXT,
            itemId: 2349,
            label: "Bronze",
            centerOffsetX: -165,
            buttonRawY: 116,
        },
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_IRON,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_IRON_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_IRON_TEXT,
            itemId: 2351,
            label: "Iron",
            centerOffsetX: -55,
            buttonRawY: 116,
        },
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_STEEL,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_STEEL_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_STEEL_TEXT,
            itemId: 2353,
            label: "Steel",
            centerOffsetX: 55,
            buttonRawY: 116,
        },
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_MITHRIL,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_MITHRIL_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_MITHRIL_TEXT,
            itemId: 2359,
            label: "Mithril",
            centerOffsetX: 165,
            buttonRawY: 116,
        },
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_ADAMANT,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_ADAMANT_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_ADAMANT_TEXT,
            itemId: 2361,
            label: "Adamant",
            centerOffsetX: -110,
            buttonRawY: 176,
        },
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_RUNE,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_RUNE_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_RUNE_TEXT,
            itemId: 2363,
            label: "Rune",
            centerOffsetX: 0,
            buttonRawY: 176,
        },
        {
            componentId: SMITHING_BAR_MODAL_COMPONENT_LOVAKITE,
            iconComponentId: SMITHING_BAR_MODAL_COMPONENT_LOVAKITE_ICON,
            textComponentId: SMITHING_BAR_MODAL_COMPONENT_LOVAKITE_TEXT,
            itemId: 13354,
            label: "Lovakite",
            centerOffsetX: 110,
            buttonRawY: 176,
        },
    ] as const;
    for (const buttonDef of buttonDefs) {
        const button = smithingBarWidget(buttonDef.componentId, rootUid, {
            type: 3,
            rawX: buttonDef.centerOffsetX,
            rawY: buttonDef.buttonRawY,
            rawWidth: 96,
            rawHeight: 56,
            xPositionMode: 1,
            width: 96,
            height: 56,
            scrollWidth: 0,
            scrollHeight: 0,
            filled: true,
            color: 0x241e16,
            mouseOverColor: 0x3a3022,
            textColor: 0x241e16,
            opacity: 32,
            actions: ["Select"],
            flags: FLAG_TRANSMIT_OP1,
        });
        widgets.set(button.uid, button);

        const border = smithingBarWidget(buttonDef.componentId + 50, rootUid, {
            type: 3,
            rawX: buttonDef.centerOffsetX,
            rawY: buttonDef.buttonRawY,
            rawWidth: 96,
            rawHeight: 56,
            xPositionMode: 1,
            width: 96,
            height: 56,
            filled: false,
            color: 0x8f7f66,
            textColor: 0x8f7f66,
            opacity: 0,
        });
        widgets.set(border.uid, border);

        const icon = smithingBarWidget(buttonDef.iconComponentId, button.uid, {
            type: 5,
            parentUid: rootUid,
            rawX: buttonDef.centerOffsetX,
            rawY: buttonDef.buttonRawY + 2,
            rawWidth: 32,
            rawHeight: 32,
            xPositionMode: 1,
            width: 32,
            height: 32,
            itemId: buttonDef.itemId,
            itemQuantity: 1,
            itemQuantityMode: 0,
        });
        widgets.set(icon.uid, icon);

        const label = smithingBarWidget(buttonDef.textComponentId, button.uid, {
            type: 4,
            parentUid: rootUid,
            rawX: buttonDef.centerOffsetX,
            rawY: buttonDef.buttonRawY + 34,
            rawWidth: 92,
            rawHeight: 18,
            xPositionMode: 1,
            width: 92,
            height: 18,
            text: buttonDef.label,
            fontId: FONT_PLAIN_11,
            textColor: 0xe8ded0,
            textShadowed: true,
            xTextAlignment: 1,
            yTextAlignment: 2,
        });
        widgets.set(label.uid, label);
    }

    const closeButton = smithingBarWidget(SMITHING_BAR_MODAL_COMPONENT_CLOSE, rootUid, {
        type: 0,
        rawX: 0,
        rawY: 24,
        rawWidth: 118,
        rawHeight: 30,
        xPositionMode: 1,
        yPositionMode: 2,
        width: 118,
        height: 30,
        scrollWidth: 0,
        scrollHeight: 0,
        actions: ["Close"],
        flags: FLAG_TRANSMIT_OP1,
    });
    widgets.set(closeButton.uid, closeButton);

    return { root, widgets };
}
