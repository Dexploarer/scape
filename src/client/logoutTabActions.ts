import { LoginIndex } from "./login/GameState";

export const LOGOUT_TAB_INTERFACE_GROUP_ID = 182;
export const LOGOUT_TAB_WORLD_SWITCH_CONTENT_TYPE = 206;
export const LOGOUT_TAB_LOGOUT_CONTENT_TYPE = 205;

const LOGOUT_TAB_WORLD_SWITCH_CHILD_IDS = new Set([3, 7]);
const LOGOUT_TAB_LOGOUT_CHILD_IDS = new Set([8, 12]);

export type LogoutTabIntent = "logout" | "server_list";
export type PostLogoutView = "welcome" | "server_list";

type LogoutTabIntentInput = {
    groupId?: number;
    childId?: number;
    contentType?: number;
    option?: string;
};

type PostLogoutLoginState = {
    loginIndex: LoginIndex;
    serverListOpen: boolean;
    hoveredServerIndex: number;
    worldSelectOpen: boolean;
    hoveredWorldId: number;
    worldSelectPage: number;
    virtualKeyboardVisible: boolean;
};

function normalizeActionLabel(value: string | undefined): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.replace(/<[^>]+>/g, "").trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

export function resolveLogoutTabIntent(input: LogoutTabIntentInput): LogoutTabIntent | undefined {
    if ((input.groupId ?? -1) !== LOGOUT_TAB_INTERFACE_GROUP_ID) {
        return undefined;
    }

    const option = normalizeActionLabel(input.option);
    if (option === "logout") {
        return "logout";
    }
    if (option === "world switcher") {
        return "server_list";
    }

    if (
        LOGOUT_TAB_WORLD_SWITCH_CHILD_IDS.has((input.childId ?? -1) | 0) ||
        ((input.contentType ?? 0) | 0) === LOGOUT_TAB_WORLD_SWITCH_CONTENT_TYPE
    ) {
        return "server_list";
    }

    if (
        LOGOUT_TAB_LOGOUT_CHILD_IDS.has((input.childId ?? -1) | 0) ||
        ((input.contentType ?? 0) | 0) === LOGOUT_TAB_LOGOUT_CONTENT_TYPE
    ) {
        return "logout";
    }

    return undefined;
}

export function applyPostLogoutLoginState(
    state: PostLogoutLoginState,
    postLogoutView: PostLogoutView,
): void {
    state.loginIndex = LoginIndex.WELCOME;
    state.serverListOpen = postLogoutView === "server_list";
    state.hoveredServerIndex = -1;
    state.worldSelectOpen = false;
    state.hoveredWorldId = -1;
    state.worldSelectPage = 0;
    state.virtualKeyboardVisible = false;
}
