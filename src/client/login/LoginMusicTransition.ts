import { GameState } from "./GameState";

export function isLoginMusicState(state: GameState): boolean {
    return (
        state === GameState.LOGIN_SCREEN ||
        state === GameState.CONNECTING ||
        state === GameState.SPECIAL_LOGIN
    );
}

export function shouldFadeOutLoginMusicForTransition(
    oldState: GameState,
    newState: GameState,
): boolean {
    return isLoginMusicState(oldState) && !isLoginMusicState(newState);
}

export function shouldStartScheduledLoginMusic(
    state: GameState,
    titleMusicDisabled: boolean,
    playingJingle: boolean,
): boolean {
    return isLoginMusicState(state) && !titleMusicDisabled && !playingJingle;
}
