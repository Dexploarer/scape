import { describe, expect, test } from "bun:test";

import { GameState, LoginIndex } from "../src/client/login/GameState";
import { LoginRenderer } from "../src/client/login/LoginRenderer";
import { LoginState } from "../src/client/login/LoginState";

describe("LoginRenderer welcome screen", () => {
    test("both welcome buttons route to the shared credential form flow", () => {
        const renderer = new LoginRenderer();
        const state = new LoginState();
        state.loginIndex = LoginIndex.WELCOME;

        const newUserAction = renderer.handleMouseClick(
            state,
            renderer.loginBoxCenter - 80,
            291,
            1,
            GameState.LOGIN_SCREEN,
        );
        const existingUserAction = renderer.handleMouseClick(
            state,
            renderer.loginBoxCenter + 80,
            291,
            1,
            GameState.LOGIN_SCREEN,
        );

        expect(newUserAction).toEqual({ type: "existing_user" });
        expect(existingUserAction).toEqual({ type: "existing_user" });
    });
});
