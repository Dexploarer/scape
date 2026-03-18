/**
 * Boss Combat Script Framework
 *
 * Provides a structured way to implement complex boss mechanics:
 * - Phase transitions
 * - Special attacks with cooldowns
 * - Mechanic telegraphing
 * - Death animations and loot handling
 * - Multi-phase boss support
 */
import { Actor } from "../actor";
import { NpcState } from "../npc";
import { PlayerState } from "../player";
import { DropEligibility, damageTracker } from "./DamageTracker";
import { multiCombatSystem } from "./MultiCombatZones";

// Type aliases for compatibility
type Npc = NpcState;
type Player = PlayerState;

// Boss phase definition
export interface BossPhase {
    name: string;
    // HP threshold to transition (percentage or absolute)
    hpThreshold?: number;
    hpThresholdPercent?: number;
    // Attack patterns available in this phase
    attackPatterns: string[];
    // Special mechanics active in this phase
    mechanics?: string[];
    // On-enter callback
    onEnter?: (boss: BossScript) => void;
    // On-exit callback
    onExit?: (boss: BossScript) => void;
}

// Special attack definition
export interface BossSpecialAttack {
    name: string;
    // Cooldown in ticks
    cooldown: number;
    // Animation ID
    animation: number;
    // Projectile graphic (if ranged/magic)
    projectile?: number;
    // Damage range
    minDamage: number;
    maxDamage: number;
    // Attack style
    style: "melee" | "ranged" | "magic" | "typeless";
    // Area of effect radius (0 for single target)
    aoeRadius?: number;
    // Telegraph delay in ticks (warning before attack lands)
    telegraphTicks?: number;
    // Custom execution function
    execute?: (boss: BossScript, target: Actor) => void;
    // Condition to use this attack
    condition?: (boss: BossScript) => boolean;
}

// Boss mechanic (persistent effects)
export interface BossMechanic {
    name: string;
    // Interval in ticks (0 for continuous)
    interval: number;
    // Execute mechanic
    tick: (boss: BossScript, tickCount: number) => void;
    // Check if mechanic should activate
    shouldActivate?: (boss: BossScript) => boolean;
}

// Boss script state
interface BossState {
    currentPhase: number;
    phaseTransitioning: boolean;
    attackCooldowns: Map<string, number>;
    mechanicTimers: Map<string, number>;
    lastAttackTick: number;
    spawnTick: number;
    customData: Map<string, any>;
}

/**
 * Base class for boss combat scripts
 */
export abstract class BossScript {
    // The NPC this script controls
    protected npc: Npc;

    // Current target
    protected target: Actor | null = null;

    // Boss phases
    protected phases: BossPhase[] = [];

    // Special attacks registry
    protected specialAttacks: Map<string, BossSpecialAttack> = new Map();

    // Active mechanics
    protected mechanics: Map<string, BossMechanic> = new Map();

    // Internal state
    protected state: BossState;

    // Current game tick (updated each tick)
    protected currentTick: number = 0;

    constructor(npc: Npc) {
        this.npc = npc;
        this.state = {
            currentPhase: 0,
            phaseTransitioning: false,
            attackCooldowns: new Map(),
            mechanicTimers: new Map(),
            lastAttackTick: 0,
            spawnTick: 0,
            customData: new Map(),
        };

        this.initialize();
    }

    /**
     * Initialize boss - override to define phases, attacks, mechanics
     */
    protected abstract initialize(): void;

    /**
     * Process one tick of boss logic
     */
    tick(currentTick: number): void {
        this.currentTick = currentTick;

        // Check for phase transitions
        this.checkPhaseTransition();

        // Process active mechanics
        this.processMechanics();

        // Update cooldowns
        this.updateCooldowns();

        // If in combat, process combat logic
        if (this.target && !this.state.phaseTransitioning) {
            this.processCombat();
        }
    }

    /**
     * Handle being attacked
     */
    onAttacked(attacker: Actor, damage: number): void {
        // Set target if we don't have one
        if (!this.target) {
            this.target = attacker;
        }

        // Let subclasses handle
        this.onDamageTaken(attacker, damage);
    }

    /**
     * Override to handle damage taken
     */
    protected onDamageTaken(attacker: Actor, damage: number): void {
        // Default: no special handling
    }

    /**
     * Check and handle phase transitions
     */
    protected checkPhaseTransition(): void {
        if (this.state.phaseTransitioning) return;
        if (this.state.currentPhase >= this.phases.length - 1) return;

        const nextPhase = this.phases[this.state.currentPhase + 1];
        const currentHp = this.npc.getHitpoints();
        const maxHp = this.npc.getMaxHitpoints();

        let shouldTransition = false;

        if (nextPhase.hpThresholdPercent !== undefined) {
            shouldTransition = currentHp <= maxHp * (nextPhase.hpThresholdPercent / 100);
        } else if (nextPhase.hpThreshold !== undefined) {
            shouldTransition = currentHp <= nextPhase.hpThreshold;
        }

        if (shouldTransition) {
            this.transitionToPhase(this.state.currentPhase + 1);
        }
    }

    /**
     * Transition to a new phase
     */
    protected transitionToPhase(phaseIndex: number): void {
        const oldPhase = this.phases[this.state.currentPhase];
        const newPhase = this.phases[phaseIndex];

        this.state.phaseTransitioning = true;

        // Call exit callback on old phase
        if (oldPhase.onExit) {
            oldPhase.onExit(this);
        }

        // Update phase
        this.state.currentPhase = phaseIndex;

        // Call enter callback on new phase
        if (newPhase.onEnter) {
            newPhase.onEnter(this);
        }

        // Let subclass handle transition
        this.onPhaseTransition(phaseIndex, newPhase);

        this.state.phaseTransitioning = false;
    }

    /**
     * Override to handle phase transitions
     */
    protected onPhaseTransition(phaseIndex: number, phase: BossPhase): void {
        // Default: no special handling
    }

    /**
     * Process active mechanics
     */
    protected processMechanics(): void {
        const currentPhase = this.phases[this.state.currentPhase];
        const activeMechanics = currentPhase?.mechanics || [];

        for (const mechanicName of activeMechanics) {
            const mechanic = this.mechanics.get(mechanicName);
            if (!mechanic) continue;

            // Check activation condition
            if (mechanic.shouldActivate && !mechanic.shouldActivate(this)) {
                continue;
            }

            // Get/initialize timer
            let timer = this.state.mechanicTimers.get(mechanicName) ?? 0;

            // Execute if interval reached
            if (mechanic.interval === 0 || timer >= mechanic.interval) {
                mechanic.tick(this, this.currentTick);
                timer = 0;
            } else {
                timer++;
            }

            this.state.mechanicTimers.set(mechanicName, timer);
        }
    }

    /**
     * Update attack cooldowns
     */
    protected updateCooldowns(): void {
        for (const [attackName, cooldown] of this.state.attackCooldowns) {
            if (cooldown > 0) {
                this.state.attackCooldowns.set(attackName, cooldown - 1);
            }
        }
    }

    /**
     * Process combat logic
     */
    protected processCombat(): void {
        if (!this.target) return;

        // Check if target is still valid
        if (!this.isValidTarget(this.target)) {
            this.target = this.findNewTarget();
            if (!this.target) return;
        }

        // Check if we can attack this tick
        if (!this.canAttack()) return;

        // Select and execute attack
        const attack = this.selectAttack();
        if (attack) {
            this.executeAttack(attack);
        }
    }

    /**
     * Check if target is still valid
     */
    protected isValidTarget(target: Actor): boolean {
        if (target instanceof PlayerState) {
            // Check if player is online and in range
            return true; // Implement actual checks
        }
        return target !== null;
    }

    /**
     * Find a new target
     */
    protected findNewTarget(): Actor | null {
        // Get last attacker from multi-combat system
        return multiCombatSystem.getLastAttacker(this.npc, this.currentTick);
    }

    /**
     * Check if boss can attack this tick
     */
    protected canAttack(): boolean {
        // Basic attack speed check
        const attackSpeed = this.getAttackSpeed();
        return this.currentTick - this.state.lastAttackTick >= attackSpeed;
    }

    /**
     * Get attack speed in ticks
     */
    protected getAttackSpeed(): number {
        return 4; // Default: 4 ticks (2.4s)
    }

    /**
     * Select an attack to use
     */
    protected selectAttack(): BossSpecialAttack | null {
        const currentPhase = this.phases[this.state.currentPhase];
        const availablePatterns = currentPhase?.attackPatterns || [];

        // Shuffle patterns for variety
        const shuffled = [...availablePatterns].sort(() => Math.random() - 0.5);

        for (const patternName of shuffled) {
            const attack = this.specialAttacks.get(patternName);
            if (!attack) continue;

            // Check cooldown
            const cooldown = this.state.attackCooldowns.get(patternName) ?? 0;
            if (cooldown > 0) continue;

            // Check condition
            if (attack.condition && !attack.condition(this)) continue;

            return attack;
        }

        return null;
    }

    /**
     * Execute an attack
     */
    protected executeAttack(attack: BossSpecialAttack): void {
        if (!this.target) return;

        // Set cooldown
        this.state.attackCooldowns.set(attack.name, attack.cooldown);
        this.state.lastAttackTick = this.currentTick;

        // Play animation
        // this.npc.animate(attack.animation);

        // Custom execution or default
        if (attack.execute) {
            attack.execute(this, this.target);
        } else {
            this.defaultAttackExecution(attack, this.target);
        }
    }

    /**
     * Default attack execution
     */
    protected defaultAttackExecution(attack: BossSpecialAttack, target: Actor): void {
        // Calculate damage
        const damage = Math.floor(
            Math.random() * (attack.maxDamage - attack.minDamage + 1) + attack.minDamage,
        );

        // Apply after telegraph delay
        if (attack.telegraphTicks && attack.telegraphTicks > 0) {
            // Schedule delayed damage - this would need integration with game tick system
            // For now, apply immediately
        }

        // AOE handling
        if (attack.aoeRadius && attack.aoeRadius > 0) {
            // Apply to all targets in radius - implement based on your world system
        } else {
            // Single target damage
            this.dealDamage(target, damage, attack.style);
        }
    }

    /**
     * Deal damage to a target
     */
    protected dealDamage(target: Actor, damage: number, style: string): void {
        // This would integrate with your existing damage system
        // target.damage(damage, style, this.npc);
    }

    /**
     * Handle boss death
     */
    onDeath(): void {
        // Get drop eligibility
        const eligibility = damageTracker.getDropEligibility(this.npc);

        // Process drops
        this.processDrops(eligibility);

        // Clean up tracking
        damageTracker.clearNpc(this.npc);

        // Custom death handling
        this.onBossDeath(eligibility);
    }

    /**
     * Process drops for eligible players
     */
    protected processDrops(eligibility: DropEligibility): void {
        // Override in subclasses for custom drop logic
    }

    /**
     * Override for custom death handling
     */
    protected onBossDeath(eligibility: DropEligibility): void {
        // Default: no special handling
    }

    /**
     * Get/set custom state data
     */
    protected getData<T>(key: string): T | undefined {
        return this.state.customData.get(key) as T;
    }

    protected setData<T>(key: string, value: T): void {
        this.state.customData.set(key, value);
    }

    /**
     * Helper to register a phase
     */
    protected addPhase(phase: BossPhase): void {
        this.phases.push(phase);
    }

    /**
     * Helper to register a special attack
     */
    protected addSpecialAttack(attack: BossSpecialAttack): void {
        this.specialAttacks.set(attack.name, attack);
    }

    /**
     * Helper to register a mechanic
     */
    protected addMechanic(mechanic: BossMechanic): void {
        this.mechanics.set(mechanic.name, mechanic);
    }

    /**
     * Get the current phase
     */
    getCurrentPhase(): BossPhase | null {
        return this.phases[this.state.currentPhase] || null;
    }

    /**
     * Get the NPC
     */
    getNpc(): Npc {
        return this.npc;
    }
}

/**
 * Registry for boss scripts
 */
const bossScriptRegistry = new Map<number, new (npc: Npc) => BossScript>();

export function registerBossScript(npcId: number, scriptClass: new (npc: Npc) => BossScript): void {
    bossScriptRegistry.set(npcId, scriptClass);
}

export function getBossScript(npcId: number): (new (npc: Npc) => BossScript) | undefined {
    return bossScriptRegistry.get(npcId);
}

export function createBossScript(npc: Npc): BossScript | null {
    const ScriptClass = bossScriptRegistry.get(npc.typeId);
    if (ScriptClass) {
        return new ScriptClass(npc);
    }
    return null;
}

// ============================================
// Example Boss Implementations
// ============================================

/**
 * Example: Giant Mole Boss Script
 */
export class GiantMoleScript extends BossScript {
    protected initialize(): void {
        // Single phase boss
        this.addPhase({
            name: "Normal",
            attackPatterns: ["claw", "stomp"],
            mechanics: ["dig_escape"],
        });

        // Basic claw attack
        this.addSpecialAttack({
            name: "claw",
            cooldown: 4,
            animation: 3312,
            minDamage: 1,
            maxDamage: 21,
            style: "melee",
        });

        // Stomp attack
        this.addSpecialAttack({
            name: "stomp",
            cooldown: 6,
            animation: 3313,
            minDamage: 5,
            maxDamage: 30,
            style: "melee",
            aoeRadius: 1,
        });

        // Dig escape mechanic - burrows when low HP
        this.addMechanic({
            name: "dig_escape",
            interval: 10,
            shouldActivate: (boss) => {
                const npc = boss.getNpc();
                const hpPercent = npc.getHitpoints() / npc.getMaxHitpoints();
                return hpPercent < 0.5 && Math.random() < 0.15;
            },
            tick: (boss) => {
                // Teleport to random location in lair
                // boss.getNpc().animate(3314); // Dig animation
                // Implement teleport logic
            },
        });
    }
}

/**
 * Example: Dagannoth Rex (DK Kings) Boss Script
 */
export class DagannothRexScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["melee_attack"],
        });

        this.addSpecialAttack({
            name: "melee_attack",
            cooldown: 4,
            animation: 2853,
            minDamage: 1,
            maxDamage: 26,
            style: "melee",
        });
    }

    protected getAttackSpeed(): number {
        return 4;
    }
}

/**
 * Example: Dagannoth Prime Boss Script
 */
export class DagannothPrimeScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["magic_attack"],
        });

        this.addSpecialAttack({
            name: "magic_attack",
            cooldown: 4,
            animation: 2854,
            projectile: 162,
            minDamage: 1,
            maxDamage: 50,
            style: "magic",
        });
    }
}

/**
 * Example: Dagannoth Supreme Boss Script
 */
export class DagannothSupremeScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["ranged_attack"],
        });

        this.addSpecialAttack({
            name: "ranged_attack",
            cooldown: 4,
            animation: 2855,
            projectile: 294,
            minDamage: 1,
            maxDamage: 30,
            style: "ranged",
        });
    }
}

/**
 * Example: General Graardor (Bandos GWD) Boss Script
 */
export class GeneralGraardorScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["melee_attack", "ranged_attack"],
        });

        // Melee attack
        this.addSpecialAttack({
            name: "melee_attack",
            cooldown: 6,
            animation: 7018,
            minDamage: 1,
            maxDamage: 60,
            style: "melee",
        });

        // Ranged attack (can hit whole room)
        this.addSpecialAttack({
            name: "ranged_attack",
            cooldown: 6,
            animation: 7021,
            minDamage: 1,
            maxDamage: 35,
            style: "ranged",
            aoeRadius: 15, // Hits everyone in room
            condition: (boss) => {
                // Use ranged when target not in melee range
                return Math.random() < 0.33;
            },
        });
    }

    protected getAttackSpeed(): number {
        return 6;
    }
}

/**
 * Example: Zulrah Boss Script (Multi-phase)
 */
export class ZulrahScript extends BossScript {
    protected initialize(): void {
        // Zulrah has multiple rotation patterns
        // Simplified to show phase system

        // Green phase (ranged)
        this.addPhase({
            name: "Green",
            attackPatterns: ["ranged_attack", "venom_cloud"],
            hpThresholdPercent: 100,
        });

        // Blue phase (magic)
        this.addPhase({
            name: "Blue",
            attackPatterns: ["magic_attack", "venom_cloud"],
            hpThresholdPercent: 75,
            onEnter: (boss) => {
                // boss.getNpc().setTransformation(2043); // Blue form
            },
        });

        // Red phase (melee)
        this.addPhase({
            name: "Red",
            attackPatterns: ["melee_attack"],
            hpThresholdPercent: 50,
            onEnter: (boss) => {
                // boss.getNpc().setTransformation(2044); // Red form
            },
        });

        // Back to green
        this.addPhase({
            name: "Green Final",
            attackPatterns: ["ranged_attack", "venom_cloud", "snakeling"],
            hpThresholdPercent: 25,
            onEnter: (boss) => {
                // boss.getNpc().setTransformation(2042); // Green form
            },
        });

        // Ranged attack
        this.addSpecialAttack({
            name: "ranged_attack",
            cooldown: 4,
            animation: 5069,
            projectile: 1044,
            minDamage: 1,
            maxDamage: 41,
            style: "ranged",
        });

        // Magic attack
        this.addSpecialAttack({
            name: "magic_attack",
            cooldown: 4,
            animation: 5069,
            projectile: 1046,
            minDamage: 1,
            maxDamage: 41,
            style: "magic",
        });

        // Melee attack (red phase only)
        this.addSpecialAttack({
            name: "melee_attack",
            cooldown: 3,
            animation: 5806,
            minDamage: 1,
            maxDamage: 32,
            style: "melee",
        });

        // Venom cloud
        this.addSpecialAttack({
            name: "venom_cloud",
            cooldown: 12,
            animation: 5069,
            minDamage: 0,
            maxDamage: 0,
            style: "typeless",
            execute: (boss, target) => {
                // Spawn venom cloud at target location
                // Implement cloud spawning logic
            },
        });

        // Snakeling spawn
        this.addSpecialAttack({
            name: "snakeling",
            cooldown: 20,
            animation: 5069,
            minDamage: 0,
            maxDamage: 0,
            style: "typeless",
            execute: (boss, target) => {
                // Spawn snakeling NPCs
            },
        });
    }

    protected getAttackSpeed(): number {
        return 4;
    }
}

// Register example boss scripts
registerBossScript(5779, GiantMoleScript); // Giant Mole
registerBossScript(2265, DagannothRexScript); // Dagannoth Rex
registerBossScript(2266, DagannothPrimeScript); // Dagannoth Prime
registerBossScript(2267, DagannothSupremeScript); // Dagannoth Supreme
registerBossScript(2215, GeneralGraardorScript); // General Graardor
registerBossScript(2042, ZulrahScript); // Zulrah
