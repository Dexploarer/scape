import { describe, expect, test } from "bun:test";

import { LoginIndex } from "../src/client/login/GameState";
import { LoginState } from "../src/client/login/LoginState";
import {
    applyPostLogoutLoginState,
    resolveLogoutTabIntent,
} from "../src/client/logoutTabActions";

describe("resolveLogoutTabIntent", () => {
    test("maps the in-game logout button to logout", () => {
        expect(resolveLogoutTabIntent({
            groupId: 182,
            childId: 8,
            option: "Logout",
        })).toBe("logout");
    });

    test("maps the in-game world switcher button to the login server list", () => {
        expect(resolveLogoutTabIntent({
            groupId: 182,
            childId: 3,
            option: "World Switcher",
        })).toBe("server_list");
    });

    test("recognizes logout-tab text widgets by content type", () => {
        expect(resolveLogoutTabIntent({
            groupId: 182,
            childId: 12,
            contentType: 205,
        })).toBe("logout");

        expect(resolveLogoutTabIntent({
            groupId: 182,
            childId: 7,
            contentType: 206,
        })).toBe("server_list");
    });

    test("ignores unrelated widgets", () => {
        expect(resolveLogoutTabIntent({
            groupId: 149,
            childId: 0,
            option: "Logout",
        })).toBeUndefined();
        expect(resolveLogoutTabIntent({
            groupId: 149,
            childId: 0,
            option: undefined,
        })).toBeUndefined();
    });
});

describe("applyPostLogoutLoginState", () => {
    test("opens the existing login-page server selector for world switching", () => {
        const state = new LoginState();
        state.loginIndex = LoginIndex.LOGIN_FORM;
        state.serverListOpen = false;
        state.hoveredServerIndex = 5;
        state.worldSelectOpen = true;
        state.hoveredWorldId = 320;
        state.worldSelectPage = 2;
        state.virtualKeyboardVisible = true;

        applyPostLogoutLoginState(state, "server_list");

        expect(state.loginIndex).toBe(LoginIndex.WELCOME);
        expect(state.serverListOpen).toBe(true);
        expect(state.hoveredServerIndex).toBe(-1);
        expect(state.worldSelectOpen).toBe(false);
        expect(state.hoveredWorldId).toBe(-1);
        expect(state.worldSelectPage).toBe(0);
        expect(state.virtualKeyboardVisible).toBe(false);
    });

    test("returns to the normal welcome screen for a plain logout", () => {
        const state = new LoginState();
        state.serverListOpen = true;

        applyPostLogoutLoginState(state, "welcome");

        expect(state.loginIndex).toBe(LoginIndex.WELCOME);
        expect(state.serverListOpen).toBe(false);
    });
});
