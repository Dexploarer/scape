// Lightweight contract between your engine and the UI for emotes.
// Implement this on your engine side and attach an instance to ctx.game.emotes.

export type EmoteIndex = number;

export type EmoteState = {
    // Whether this emote index exists in this build/profile
    present: boolean;
    // Whether the player has this emote unlocked
    unlocked: boolean;
    // Action availability
    canPerform: boolean;
    canLoop: boolean;
    // Optional presentation overrides
    name?: string;
    // Prefer sprite IDs; tokens are optional fallbacks if you keep name-based tokens around
    spriteUnlockedId?: number;
    spriteLockedId?: number;
    spriteUnlockedToken?: string;
    spriteLockedToken?: string;
    // Optional variant (e.g., index 50 League outfit variant)
    variant?: number;
};

export interface EmoteService {
    // Enumerate emote indices to display (e.g., [0..54])
    allIndices?(): EmoteIndex[];
    // Get current state for an emote
    getState(index: EmoteIndex): EmoteState | undefined;
    // Trigger an emote; loop defaults to false
    perform(index: EmoteIndex, opts?: { loop?: boolean }): void;
    // Optional change subscription so UI can re-render immediately on updates
    onChange?(cb: () => void): () => void;
}
