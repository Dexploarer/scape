import { GameState } from "../login/GameState";

/**
 * Represents a state transition event.
 */
export interface StateTransition {
    from: GameState;
    to: GameState;
    timestamp: number;
}

/**
 * Listener callback for state transitions.
 */
export type StateListener = (transition: StateTransition) => void;

/**
 * Valid state transitions map.
 * Defines which transitions are allowed from each state.
 */
const VALID_TRANSITIONS: Map<GameState, GameState[]> = new Map([
    [GameState.DOWNLOADING, [GameState.LOADING, GameState.ERROR]],
    [GameState.LOADING, [GameState.LOGIN_SCREEN, GameState.ERROR]],
    [GameState.LOGIN_SCREEN, [GameState.CONNECTING, GameState.SPECIAL_LOGIN, GameState.ERROR]],
    [GameState.CONNECTING, [GameState.LOADING_GAME, GameState.LOGIN_SCREEN, GameState.ERROR]],
    [
        GameState.LOADING_GAME,
        [GameState.LOGGED_IN, GameState.LOGIN_SCREEN, GameState.CONNECTION_LOST, GameState.ERROR],
    ],
    [
        GameState.LOGGED_IN,
        [
            GameState.LOGIN_SCREEN,
            GameState.CONNECTION_LOST,
            GameState.RECONNECTING,
            GameState.PLEASE_WAIT,
            GameState.LOADING_GAME,
            GameState.ERROR,
        ],
    ],
    [
        GameState.RECONNECTING,
        [GameState.LOGGED_IN, GameState.LOGIN_SCREEN, GameState.CONNECTION_LOST, GameState.ERROR],
    ],
    [
        GameState.PLEASE_WAIT,
        [GameState.LOGGED_IN, GameState.LOGIN_SCREEN, GameState.CONNECTION_LOST, GameState.ERROR],
    ],
    [
        GameState.CONNECTION_LOST,
        [
            GameState.RECONNECTING,
            GameState.LOGIN_SCREEN,
            GameState.LOADING_GAME,
            GameState.LOGGED_IN,
            GameState.ERROR,
        ],
    ],
    [GameState.SPECIAL_LOGIN, [GameState.CONNECTING, GameState.LOGIN_SCREEN, GameState.ERROR]],
    [GameState.ERROR, [GameState.LOGIN_SCREEN]],
]);

/**
 * Centralized game state machine.
 * Provides atomic state transitions with validation and synchronous listener notification.
 *
 * This replaces the scattered state management across OsrsClient, LoginState, and overlays.
 * All state changes go through this class, ensuring:
 * - Single source of truth for game state
 * - Atomic transitions with validation
 * - Synchronous notification to all subscribers (no race conditions)
 */
export class GameStateMachine {
    private state: GameState = GameState.DOWNLOADING;
    private listeners: Set<StateListener> = new Set();
    private transitionHistory: StateTransition[] = [];
    private readonly maxHistorySize = 20;

    constructor(initialState: GameState = GameState.DOWNLOADING) {
        this.state = initialState;
    }

    /**
     * Get the current game state.
     */
    getState(): GameState {
        return this.state;
    }

    /**
     * Get human-readable state name.
     */
    getStateName(): string {
        const stateName = GameState[this.state];
        return typeof stateName === "string" ? stateName : `UNKNOWN(${this.state})`;
    }

    /**
     * Attempt to transition to a new state.
     * Returns true if transition was successful, false if invalid.
     *
     * @param newState The state to transition to
     * @param force If true, bypass validation (use sparingly)
     */
    transition(newState: GameState, force: boolean = false): boolean {
        if (this.state === newState) {
            // No-op: already in this state
            return true;
        }

        // Validate transition
        if (!force && !this.isValidTransition(this.state, newState)) {
            console.warn(
                `[GameStateMachine] Invalid transition: ${GameState[this.state]} -> ${
                    GameState[newState]
                }`,
            );
            return false;
        }

        const transition: StateTransition = {
            from: this.state,
            to: newState,
            timestamp: performance.now(),
        };

        const oldState = this.state;
        this.state = newState;

        // Record history
        this.transitionHistory.push(transition);
        if (this.transitionHistory.length > this.maxHistorySize) {
            this.transitionHistory.shift();
        }

        console.log(`[GameStateMachine] ${GameState[oldState]} -> ${GameState[newState]}`);

        // Notify all listeners synchronously
        // This ensures all overlays receive the update in the same frame
        for (const listener of this.listeners) {
            try {
                listener(transition);
            } catch (e) {
                console.error("[GameStateMachine] Listener error:", e);
            }
        }

        return true;
    }

    /**
     * Check if a transition is valid.
     */
    isValidTransition(from: GameState, to: GameState): boolean {
        const validTargets = VALID_TRANSITIONS.get(from);
        return validTargets ? validTargets.includes(to) : false;
    }

    /**
     * Subscribe to state transitions.
     * Returns an unsubscribe function.
     */
    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Get the number of active listeners.
     */
    getListenerCount(): number {
        return this.listeners.size;
    }

    /**
     * Get recent transition history (for debugging).
     */
    getHistory(): readonly StateTransition[] {
        return this.transitionHistory;
    }

    /**
     * Check if currently on login screen (any login-related state).
     */
    isOnLoginScreen(): boolean {
        return (
            this.state === GameState.LOGIN_SCREEN ||
            this.state === GameState.CONNECTING ||
            this.state === GameState.SPECIAL_LOGIN
        );
    }

    /**
     * Check if currently logged in (playing the game).
     * LOADING_GAME counts as logged in since the game world renders.
     */
    isLoggedIn(): boolean {
        return (
            this.state === GameState.LOADING_GAME ||
            this.state === GameState.LOGGED_IN ||
            this.state === GameState.RECONNECTING ||
            this.state === GameState.PLEASE_WAIT
        );
    }

    /**
     * Check if in a loading state.
     */
    isLoading(): boolean {
        return (
            this.state === GameState.DOWNLOADING ||
            this.state === GameState.LOADING ||
            this.state === GameState.LOADING_GAME
        );
    }

    /**
     * Check if currently downloading cache.
     */
    isDownloading(): boolean {
        return this.state === GameState.DOWNLOADING;
    }

    /**
     * Reset to initial state (for testing or hard reset).
     */
    reset(): void {
        this.transitionHistory = [];
        this.state = GameState.DOWNLOADING;
    }
}
