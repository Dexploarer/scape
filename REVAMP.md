
---                                                                                                                                                                                                                                                                                                                 1. Move More Core Logic into Vanilla Gamemode

Right now server/src/game/ contains a lot of gameplay logic (combat, interactions, prayers, drops, death) that should live in the vanilla gamemode. The core engine should only provide:

- Tick loop, actor lifecycle, networking, state serialization
- Service interfaces (not implementations)

Everything else — combat formulas, NPC AI behavior, drop tables, skill handlers, prayer effects, death mechanics, interaction scripts — belongs in server/gamemodes/vanilla/. This is how RSMod and similar projects work: the engine is content-agnostic, gamemodes define all behavior.                                                                                                                                                                                                                                                                                                                                             
Concrete moves:
- game/combat/ → vanilla gamemode (CombatEngine, PlayerCombatManager, NpcCombatAI, AmmoSystem, HitEffects)
- game/interactions/PlayerInteractionSystem.ts → vanilla (the 2,571 LOC interaction dispatcher is content logic)
- game/drops/, game/death/, game/prayer/ → vanilla
- game/actions/handlers/ (CombatActionHandler, SpellActionHandler) → vanilla
- Core keeps only the ActionScheduler and action type definitions

This makes Leagues-V (or any future gamemode) able to override combat, death, drops etc. cleanly instead of fighting core.                                                                                                                                                                                        
---
2. Content Definition System (Data-Driven)

Other RSPS use declarative content definitions rather than imperative code. You have some of this (JSON combat stats, loot tables) but it's inconsistent.
Recommendation: Standardize a content definition pattern:

// Vanilla gamemode registers typed definitions                                                                                                                                                                                                                                                                   
contentRegistry.defineNpcCombat(NpcId.GUARD, {                                                                                                                                                                                                                                                                    
attackSpeed: 4,                                                                                                                                                                                                                                                                                                 
attackStyle: 'slash',                                                                                                                                                                                                                                                                                               maxHit: 5,                                                                                                                                                                                                                                                                                                      
aggroRadius: 3,                                                                                                                                                                                                                                                                                                 
deathAnim: 836,                                               
drops: dropTable([ /* ... */ ]),                                                                                                                                                                                                                                                                                
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
contentRegistry.defineSkillAction('cooking', {                                                                                                                                                                                                                                                                    
item: ItemId.RAW_SHRIMP,                                      
product: ItemId.SHRIMP,                                                                                                                                                                                                                                                                                         
level: 1,                                                                                                                                                                                                                                                                                                           xp: 30,                                                                                                                                                                                                                                                                                                         
burnLevel: 34,                                                                                                                                                                                                                                                                                                  
animation: 883,                                               
});                                                                                                                                                                                                                                                                                                                  
This lets you add content by adding data rows, not writing handler code per-NPC or per-item. Most mature RSPS converge on this pattern.
  ---                                                                                                                                                                                                                                                                                                               
3. Formal Plugin/Content Script API

Your ScriptRegistry is a good start but lacks structure that other RSPS have:
Recommendation:
- Define a formal ContentPlugin interface with lifecycle hooks (onLoad, onUnload, onPlayerLogin)
- Each plugin declares its dependencies (which services it needs)                                                                                                                                                                                                                                                   - Plugins are isolated — one broken plugin shouldn't crash the server
- Add a priority system so gamemodes can override vanilla handlers cleanly

interface ContentPlugin {                                                                                                                                                                                                                                                                                         
id: string;                                                                                                                                                                                                                                                                                                         dependencies?: string[];                                                                                                                                                                                                                                                                                        
priority?: number;                                                                                                                                                                                                                                                                                              
onLoad(api: PluginAPI): void;                                 
onUnload?(): void;                                                                                                                                                                                                                                                                                                }

This is essentially what RSMod's plugin system does — and it's what makes content creation scalable.
---                                                                                                                                                                                                                                                                                                               
4. Break Up the Monoliths

Several files are doing too much:

┌────────────────────────────┬────────┬────────────────────────────────────────────────────────────────────────────────────┐
│            File            │  LOC   │                                   Recommendation                                   │                                                                                                                                                                                      
├────────────────────────────┼────────┼────────────────────────────────────────────────────────────────────────────────────┤                                                                                                                                                                                      
│ OsrsClient.ts              │ 11,563 │ Split into subsystem managers (login, world loading, rendering, input, state sync) │
├────────────────────────────┼────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ CombatActionHandler.ts     │ 2,566  │ Split by combat type (melee, ranged, magic)                                        │                                                                                                                                                                                      
├────────────────────────────┼────────┼────────────────────────────────────────────────────────────────────────────────────┤                                                                                                                                                                                        │ PlayerInteractionSystem.ts │ 2,571  │ Route to per-type handlers (npc, loc, item, widget)                                │                                                                                                                                                                                      
├────────────────────────────┼────────┼────────────────────────────────────────────────────────────────────────────────────┤                                                                                                                                                                                        │ wsServer.ts                │ 1,460  │ Continue your decomposition — this should be a thin router                         │
├────────────────────────────┼────────┼────────────────────────────────────────────────────────────────────────────────────┤                                                                                                                                                                                        │ LeagueTaskManager.ts       │ 17,946 │ This is enormous — break into task categories or subsystems                        │                                                                                                                                                                                      
└────────────────────────────┴────────┴────────────────────────────────────────────────────────────────────────────────────┘
  ---                                                                                                                                                                                                                                                                                                               
5. Proper Event Bus

Replace direct service-to-service calls with a typed event bus for game events:
// Core defines event types                                                                                                                                                                                                                                                                                       
type GameEvents = {                                                                                                                                                                                                                                                                                               
'player:death': { player: PlayerState; killer?: Actor };                                                                                                                                                                                                                                                        
'npc:death': { npc: NpcState; killer: PlayerState };                                                                                                                                                                                                                                                            
'skill:levelup': { player: PlayerState; skill: SkillId; level: number };                                                                                                                                                                                                                                        
'item:equip': { player: PlayerState; item: number; slot: EquipSlot };                                                                                                                                                                                                                                           
};                                                                                                                                                                                                                                                                                                                                                                                  
// Any gamemode/plugin can listen                                                                                                                                                                                                                                                                                 
events.on('npc:death', ({ npc, killer }) => {                                                                                                                                                                                                                                                                     
rollDropTable(npc, killer);                                                                                                                                                                                                                                                                                     
checkSlayerTask(killer, npc);
checkCollectionLog(killer, npc);                                                                                                                                                                                                                                                                                
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
This decouples systems — combat doesn't need to know about slayer, collection log, achievements, etc. Every mature RSPS has this. It also makes Leagues-V trivial to hook into (listen for events, award points).
  ---                                                                                                                                                                                                                                                                                                               
6. Standardize NPC/Object Interaction Pattern                                                                                                                                                                                                                                                                     
   Other RSPS use a clean dispatch pattern:

// Instead of one giant PlayerInteractionSystem switch                                                                                                                                                                                                                                                            
@NpcInteraction(NpcId.BANKER, 'Bank')                                                                                                                                                                                                                                                                             
function openBank(ctx: InteractionContext) {                                                                                                                                                                                                                                                                          ctx.player.openBank();                                                                                                                                                                                                                                                                                          
}

@ObjectInteraction(ObjectId.OAK_TREE, 'Chop down')                                                                                                                                                                                                                                                                  function chopOak(ctx: InteractionContext) {
ctx.startSkillAction(woodcutting.chop(ObjectId.OAK_TREE));                                                                                                                                                                                                                                                      
}                                                                                                                                                                                                                                                                                                                    
Whether you use decorators or a registry pattern, the key is: one file per content piece, not one mega-file routing everything.
  ---                                                                                                                                                                                                                                                                                                               
7. Persistence Layer Abstraction

Right now state serialization seems tightly coupled. For open-sourcing:

- Define a PersistenceProvider interface (save/load player data)
- Ship a default FileSystemPersistence (JSON files, what you likely have now)
- Make it easy to swap in SQLite/Postgres for production servers
- Add save versioning and migration support
  ---                                                                                                                                                                                                                                                                                                               
8. Conventions for Open Source Contribution                     
   Things that make RSPS projects successful as open source:

- Content script templates — npm run create:npc-script scaffolds a new NPC handler
- Hot-reloading content — change a script, see it in-game without restart (your ExtrascriptLoader is close to this)
- Developer commands — ::npc 1, ::item 4151, ::tele 3200 3200 (you may have these already)
- Typed IDs — branded types for NpcId, ItemId, ObjectId, AnimationId so you can't accidentally pass an item ID where an NPC ID is expected
- Content test harness — ability to unit test a skill action or combat formula without spinning up the full server                                                                                                                                                                                                
  ---
9. Priority Order

If I were sequencing this work:

1. Event bus (enables everything else, low risk)
2. Move combat/interactions/drops/death to vanilla (biggest architectural win)
3. Content definition registry (makes adding content 10x faster)
4. Break up monoliths (ongoing, do as you touch files)
5. Persistence abstraction (needed before open-source)
6. Plugin API formalization (builds on steps 1-3)

The theme across all of this: the engine should be a framework, not a game. The vanilla gamemode should be the game. That's what makes RSPS projects maintainable and extensible long-term.                                                                                                                                                                                                                                                                                                                                                                                                                                           
Want me to dive deeper into any of these, or start on an implementation plan for one?         