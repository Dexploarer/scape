import { NpcManager } from "../npcManager";
import { PlayerManager } from "../player";

export class MovementSystem {
    constructor(
        private readonly players: PlayerManager,
        private readonly npcManager?: NpcManager,
    ) {}

    runPreMovement(tick: number): void {
        // Update follow positions BEFORE processing following logic
        // This stores where each player is NOW, so followers can path to their last position
        try {
            this.players.forEach((ws, player) => {
                player.followX = player.tileX;
                player.followZ = player.tileY;
            });
            this.players.forEachBot((bot) => {
                bot.followX = bot.tileX;
                bot.followZ = bot.tileY;
            });
        } catch {}

        try {
            this.players.updateFollowing(tick);
        } catch {}
        try {
            this.players.updateNpcInteractions(tick, (npcId) => this.npcManager?.getById(npcId));
        } catch {}
        try {
            this.players.updateNpcCombatInteractions(
                tick,
                (npcId) => this.npcManager?.getById(npcId),
            );
        } catch {}
        try {
            this.players.updateLocInteractions(tick);
        } catch {}
        try {
            this.players.updateGroundItemInteractions(tick);
        } catch {}
        try {
            // Lock movement for players that are about to start a combat swing/cast this tick.
            // This prevents "move away then attack" artifacts due to tick phase ordering.
            this.players.applyCombatMovementLocks(tick, (npcId) => this.npcManager?.getById(npcId));
        } catch {}
    }

    runPostMovement(tick: number): void {
        // Post-movement checks for "just arrived" interactions
        // This fixes the 1-tick delay (run-up delay) for picking up items and using objects
        try {
            this.players.updateLocInteractions(tick);
        } catch {}
        try {
            this.players.updateGroundItemInteractions(tick);
        } catch {}
        try {
            this.players.updateNpcInteractions(tick, (npcId) => this.npcManager?.getById(npcId));
        } catch {}
        try {
            this.players.updateNpcCombatInteractions(
                tick,
                (npcId) => this.npcManager?.getById(npcId),
            );
        } catch {}
    }
}
