/**
 * Game State Management Module
 *
 * Provides centralized state management for the game client:
 * - GameStateMachine: Single source of truth for game state with atomic transitions
 * - LoadingTracker: Event-driven loading requirement tracking
 */

export { GameStateMachine } from "./GameStateMachine";
export type { StateTransition, StateListener } from "./GameStateMachine";
export { LoadingTracker, LoadingRequirement } from "./LoadingTracker";
export type { LoadingProgress, LoadingProgressListener } from "./LoadingTracker";
