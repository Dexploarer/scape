export const BOT_SDK_DRAFT_STORAGE_KEY = "osrs.sidebar.bot_sdk.draft.v1";

export type BotSdkFeedbackKind = "success" | "error" | "info";

export type BotSdkFeedback = {
    kind: BotSdkFeedbackKind;
    text: string;
};

export type BotSdkPresetDirective = {
    id: string;
    label: string;
    directive: string;
};

export const BOT_SDK_PRESET_DIRECTIVES: ReadonlyArray<BotSdkPresetDirective> = Object.freeze([
    {
        id: "follow",
        label: "Follow Me",
        directive: "Follow my player and stay close until I give a new order.",
    },
    {
        id: "hold",
        label: "Hold Position",
        directive: "Stop moving, hold your position, and wait for my next instruction.",
    },
    {
        id: "assist",
        label: "Assist Combat",
        directive: "Assist me in combat against my current target when it is safe to do so.",
    },
    {
        id: "status",
        label: "Report Status",
        directive: "Report your current location, inventory state, and nearby threats.",
    },
]);

export function normalizeBotSdkDirective(input: string): string {
    return String(input ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

export function buildBotSdkSteerCommand(input: string): string | undefined {
    const directive = normalizeBotSdkDirective(input);
    if (!directive) return undefined;
    return `::steer ${directive}`;
}

export function appendBotSdkDirectiveContext(input: string, context: string): string {
    const normalizedInput = normalizeBotSdkDirective(input);
    const normalizedContext = String(context ?? "").trim();
    if (!normalizedContext) {
        return normalizedInput;
    }
    if (!normalizedInput) {
        return normalizedContext;
    }
    return `${normalizedInput}\n\n${normalizedContext}`;
}

export function extractBotSdkFeedbackFromChat(message: {
    messageType?: string;
    text?: string;
}): BotSdkFeedback | undefined {
    const messageType = typeof message.messageType === "string" ? message.messageType : "";
    const text = String(message.text ?? "").trim();
    if (!text) return undefined;
    if (messageType !== "game") return undefined;

    if (/^Steered \d+ agent(?:s)?\.$/.test(text)) {
        return { kind: "success", text };
    }
    if (/^Installed script on \d+ agent(?:s)?\.$/.test(text)) {
        return { kind: "success", text };
    }
    if (/^Cleared scripts on \d+ agent(?:s)?\.$/.test(text)) {
        return { kind: "success", text };
    }
    if (/^Interrupted \d+ agent(?:s)? with [A-Z0-9_:-]+\.$/.test(text)) {
        return { kind: "success", text };
    }
    if (text === "No connected 'scape agents to steer.") {
        return { kind: "error", text };
    }
    if (text === "No connected 'scape agents accepted the script.") {
        return { kind: "error", text };
    }
    if (text === "No connected 'scape agents had an active script.") {
        return { kind: "error", text };
    }
    if (/^No connected 'scape agents handled interrupt [A-Z0-9_:-]+\.$/.test(text)) {
        return { kind: "error", text };
    }
    if (text === "Usage: ::steer <directive text>") {
        return { kind: "error", text };
    }
    if (text.startsWith("Bot SDK script error: ")) {
        return { kind: "error", text };
    }

    return undefined;
}
