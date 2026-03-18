/**
 * Loading requirements that must be completed before transitioning
 * from LOADING_GAME to LOGGED_IN state.
 */
export enum LoadingRequirement {
    /** Server handshake completed successfully */
    HANDSHAKE_COMPLETE = "handshake",
    /** Initial map data has been received and processed */
    MAP_DATA_LOADED = "map",
    /** Player data has been received (stats, inventory, etc.) */
    PLAYER_DATA_LOADED = "player",
    /** Core widgets have been initialized */
    WIDGETS_INITIALIZED = "widgets",
}

/**
 * Listener callback for loading progress updates.
 */
export type LoadingProgressListener = (progress: LoadingProgress) => void;

/**
 * Loading progress information.
 */
export interface LoadingProgress {
    /** Number of requirements completed */
    completed: number;
    /** Total number of requirements */
    total: number;
    /** Percentage complete (0-100) */
    percent: number;
    /** Whether all requirements are complete */
    isComplete: boolean;
    /** List of pending requirements */
    pending: LoadingRequirement[];
    /** List of completed requirements */
    completedList: LoadingRequirement[];
}

/**
 * Tracks loading requirements for game initialization.
 *
 * Replaces the hard-coded setTimeout(1500ms) approach with event-driven
 * requirement tracking. The game only transitions to LOGGED_IN when
 * all requirements are met.
 *
 * Usage:
 * ```typescript
 * const tracker = new LoadingTracker();
 *
 * // Set requirements for this login
 * tracker.setRequirements([
 *     LoadingRequirement.HANDSHAKE_COMPLETE,
 *     LoadingRequirement.MAP_DATA_LOADED,
 * ]);
 *
 * // Set callback for when all complete
 * tracker.setOnComplete(() => {
 *     stateMachine.transition(GameState.LOGGED_IN);
 * });
 *
 * // Mark requirements as complete (from various parts of the code)
 * tracker.markComplete(LoadingRequirement.HANDSHAKE_COMPLETE);
 * ```
 */
export class LoadingTracker {
    private requirements: Set<LoadingRequirement> = new Set();
    private completed: Set<LoadingRequirement> = new Set();
    private onCompleteCallback?: () => void;
    private progressListeners: Set<LoadingProgressListener> = new Set();

    // Performance: debounce progress notifications to avoid cascading re-renders
    private progressNotifyPending: boolean = false;
    private static readonly DEBOUNCE_MS = 16; // ~1 frame at 60fps

    /**
     * Set the requirements that must be completed.
     * Call this when entering LOADING_GAME state.
     */
    setRequirements(requirements: LoadingRequirement[]): void {
        this.requirements = new Set(requirements);
        this.completed.clear();
        this.notifyProgressListeners();
    }

    /**
     * Mark a requirement as complete.
     * If all requirements are now complete, fires the onComplete callback.
     */
    markComplete(requirement: LoadingRequirement): void {
        if (!this.requirements.has(requirement)) {
            console.warn(`[LoadingTracker] Marking unknown requirement: ${requirement}`);
            return;
        }

        if (this.completed.has(requirement)) {
            // Already completed, no-op
            return;
        }

        this.completed.add(requirement);
        console.log(
            `[LoadingTracker] Requirement complete: ${requirement} (${this.completed.size}/${this.requirements.size})`,
        );

        this.notifyProgressListeners();

        // Check if all requirements are complete
        if (this.isComplete()) {
            console.log("[LoadingTracker] All requirements complete!");
            this.onCompleteCallback?.();
        }
    }

    /**
     * Check if all requirements are complete.
     */
    isComplete(): boolean {
        if (this.requirements.size === 0) {
            return false; // No requirements set yet
        }
        return this.completed.size >= this.requirements.size;
    }

    /**
     * Get current loading progress.
     */
    getProgress(): LoadingProgress {
        const total = this.requirements.size;
        const completedCount = this.completed.size;
        const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        return {
            completed: completedCount,
            total,
            percent,
            isComplete: this.isComplete(),
            pending: [...this.requirements].filter((r) => !this.completed.has(r)),
            completedList: [...this.completed],
        };
    }

    /**
     * Set callback for when all requirements are complete.
     */
    setOnComplete(callback: () => void): void {
        this.onCompleteCallback = callback;

        // If already complete, fire immediately
        if (this.isComplete()) {
            callback();
        }
    }

    /**
     * Subscribe to progress updates.
     * Returns an unsubscribe function.
     */
    subscribeProgress(listener: LoadingProgressListener): () => void {
        this.progressListeners.add(listener);
        // Send initial progress immediately (no debounce for new subscribers)
        try {
            listener(this.getProgress());
        } catch (e) {
            console.error("[LoadingTracker] Progress listener error:", e);
        }
        return () => {
            this.progressListeners.delete(listener);
        };
    }

    /**
     * Reset all tracking state.
     * Call this on logout or reconnection.
     */
    reset(): void {
        this.requirements.clear();
        this.completed.clear();
        this.onCompleteCallback = undefined;
        this.notifyProgressListeners();
    }

    /**
     * Check if a specific requirement is complete.
     */
    isRequirementComplete(requirement: LoadingRequirement): boolean {
        return this.completed.has(requirement);
    }

    /**
     * Get the list of pending requirements.
     */
    getPendingRequirements(): LoadingRequirement[] {
        return [...this.requirements].filter((r) => !this.completed.has(r));
    }

    /**
     * Schedule a debounced progress notification.
     * Multiple rapid calls will be batched into a single notification.
     */
    private notifyProgressListeners(): void {
        if (this.progressNotifyPending) {
            return; // Already scheduled, will pick up latest state
        }

        this.progressNotifyPending = true;

        // Use setTimeout to batch rapid updates into a single notification
        setTimeout(() => {
            this.progressNotifyPending = false;
            this.doNotifyProgressListeners();
        }, LoadingTracker.DEBOUNCE_MS);
    }

    /**
     * Immediately notify all progress listeners (called after debounce delay).
     */
    private doNotifyProgressListeners(): void {
        const progress = this.getProgress();
        for (const listener of this.progressListeners) {
            try {
                listener(progress);
            } catch (e) {
                console.error("[LoadingTracker] Progress listener error:", e);
            }
        }
    }
}
