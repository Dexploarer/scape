/**
 * Registry for defining which actions are interruptible.
 * Interruptible actions are cancelled when a player walks, starts a new interaction, etc.
 *
 * Uses pattern matching (prefix-based) with explicit exclusions for flexibility.
 */

export class ActionInterruptionRegistry {
    private patterns: string[] = [];
    private exclusions = new Set<string>();

    /**
     * Register a pattern for interruptible actions.
     * Patterns are prefix-matched against action kinds and groups.
     * @example registry.registerPattern("skill.") // matches skill.woodcut, skill.mine, etc.
     */
    registerPattern(pattern: string): this {
        if (!this.patterns.includes(pattern)) {
            this.patterns.push(pattern);
        }
        return this;
    }

    /**
     * Exclude a specific action kind from being interruptible.
     * Exclusions take precedence over patterns.
     * @example registry.exclude("skill.special") // this specific action won't be interrupted
     */
    exclude(kind: string): this {
        this.exclusions.add(kind);
        return this;
    }

    /**
     * Remove an exclusion.
     */
    removeExclusion(kind: string): this {
        this.exclusions.delete(kind);
        return this;
    }

    /**
     * Remove a pattern.
     */
    removePattern(pattern: string): this {
        const idx = this.patterns.indexOf(pattern);
        if (idx !== -1) {
            this.patterns.splice(idx, 1);
        }
        return this;
    }

    /**
     * Check if an action kind matches any registered pattern.
     */
    isInterruptible(kind: string, groups: string[] = []): boolean {
        // Exclusions take precedence
        if (this.exclusions.has(kind)) {
            return false;
        }

        // Check kind against patterns
        for (const pattern of this.patterns) {
            if (kind.startsWith(pattern)) {
                return true;
            }
        }

        // Check groups against patterns
        for (const group of groups) {
            if (this.exclusions.has(group)) {
                continue;
            }
            for (const pattern of this.patterns) {
                if (group.startsWith(pattern)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get all registered patterns.
     */
    getPatterns(): readonly string[] {
        return this.patterns;
    }

    /**
     * Get all exclusions.
     */
    getExclusions(): readonly string[] {
        return Array.from(this.exclusions);
    }

    /**
     * Clear all patterns and exclusions.
     */
    clear(): this {
        this.patterns = [];
        this.exclusions.clear();
        return this;
    }
}

/**
 * Default registry instance with standard OSRS-like patterns.
 */
export const defaultInterruptionRegistry = new ActionInterruptionRegistry().registerPattern(
    "skill.",
);
