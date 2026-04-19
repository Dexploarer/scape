import type { AgentScriptSpec } from "../agent/AgentScript";
import type { SelectedSpellPayloadFields } from "../spells/selectedSpellPayload";

export type ShopStockEntryMessage = {
    slot: number;
    itemId: number;
    quantity: number;
    defaultQuantity?: number;
    priceEach?: number;
    sellPrice?: number;
};

export type GroundItemStackMessage = {
    id: number;
    itemId: number;
    quantity: number;
    tile: { x: number; y: number; level: number };
    createdTick?: number;
    privateUntilTick?: number;
    expiresTick?: number;
    ownerId?: number;
    isPrivate?: boolean;
    /** Mirrors RuneLite TileItem ownership constants: 0=none,1=self,2=other,3=group */
    ownership?: 0 | 1 | 2 | 3;
};

export type GroundItemsServerPayload =
    | {
          kind: "snapshot";
          serial: number;
          stacks: GroundItemStackMessage[];
      }
    | {
          kind: "delta";
          serial: number;
          upserts: GroundItemStackMessage[];
          removes: number[];
      };

export type GroundItemActionPayload = {
    stackId: number;
    tile: { x: number; y: number; level?: number };
    itemId: number;
    quantity?: number;
    option?: string; // deprecated, use opNum
    opNum?: number;
    modifierFlags?: number;
};

export type ShopServerPayload =
    | {
          kind: "open";
          shopId: string;
          name: string;
          currencyItemId: number;
          generalStore?: boolean;
          buyMode?: number;
          sellMode?: number;
          stock: ShopStockEntryMessage[];
      }
    | {
          kind: "slot";
          shopId: string;
          slot: ShopStockEntryMessage;
      }
    | {
          kind: "close";
      }
    | {
          kind: "mode";
          shopId: string;
          buyMode?: number;
          sellMode?: number;
      };

export type SmithingOptionMessage = {
    recipeId: string;
    name: string;
    level: number;
    itemId: number;
    outputQuantity: number;
    available: number;
    canMake: boolean;
    xp?: number;
    ingredientsLabel?: string;
    mode?: "smelt" | "forge";
    barItemId?: number;
    barCount?: number;
    requiresHammer?: boolean;
    hasHammer?: boolean;
};

export type SmithingServerPayload =
    | {
          kind: "open" | "update";
          mode: "smelt" | "forge";
          title?: string;
          options: SmithingOptionMessage[];
          quantityMode: number;
          customQuantity?: number;
      }
    | {
          kind: "mode";
          quantityMode: number;
          customQuantity?: number;
      }
    | {
          kind: "close";
      };

export type TradeOfferEntryMessage = {
    slot: number;
    itemId: number;
    quantity: number;
};

export type TradePartyMessage = {
    playerId?: number;
    name?: string;
    offers: TradeOfferEntryMessage[];
    accepted?: boolean;
    confirmAccepted?: boolean;
};

export type TradeServerPayload =
    | {
          kind: "request";
          fromId: number;
          fromName?: string;
      }
    | {
          kind: "open" | "update";
          sessionId: string;
          stage: "offer" | "confirm";
          self: TradePartyMessage;
          other: TradePartyMessage;
          info?: string;
      }
    | {
          kind: "close";
          reason?: string;
      };

export type SpellCastModifiers = {
    isAutocast?: boolean;
    defensive?: boolean;
    queued?: boolean;
    castMode?: "manual" | "autocast" | "defensive_autocast";
};

export type SpellCastPayloadBase = SelectedSpellPayloadFields & {
    spellId?: number;
    tile?: { x: number; y: number };
    plane?: number;
    modifierFlags?: number;
    modifiers?: SpellCastModifiers;
};

export type SpellCastNpcPayload = SpellCastPayloadBase & { npcId: number };
export type SpellCastPlayerPayload = SpellCastPayloadBase & { playerId: number };
export type SpellCastLocPayload = SpellCastPayloadBase & { locId: number };
export type SpellCastObjPayload = SpellCastPayloadBase & { objId: number };
export type SpellCastItemPayload = SpellCastPayloadBase & {
    slot: number;
    itemId: number;
    widgetId?: number;
};

export type SpellRuneDelta = {
    itemId: number;
    quantity: number;
};

export type SpellResultPayload = {
    casterId: number;
    spellId: number;
    outcome: "success" | "failure";
    reason?:
        | "invalid_spell"
        | "invalid_target"
        | "out_of_range"
        | "out_of_runes"
        | "level_requirement"
        | "cooldown"
        | "restricted_zone"
        | "immune_target"
        | "already_active"
        | "line_of_sight"
        | "server_error"
        | string;
    targetType: "npc" | "player" | "loc" | "obj" | "tile" | "item";
    targetId?: number;
    tile?: { x: number; y: number; plane?: number };
    modifiers?: SpellCastModifiers;
    runesConsumed?: SpellRuneDelta[];
    runesRefunded?: SpellRuneDelta[];
    hitDelay?: number;
    impactSpotAnim?: number;
    castSpotAnim?: number;
    splashSpotAnim?: number;
    damage?: number;
    maxHit?: number;
    accuracy?: number;
};

export type BotSdkJournalProposal = {
    proposalId: string;
    playerId: number;
    agentId: string;
    displayName: string;
    principalId?: string;
    worldCharacterId?: string;
    summary?: string;
    script: AgentScriptSpec;
    proposedAt: number;
};

export type BotSdkJournalActivity = {
    id: string;
    kind: "proposal" | "decision" | "control";
    text: string;
    timestamp: number;
    playerId?: number;
    proposalId?: string;
};

export type BotSdkJournalSnapshot = {
    targetPlayerId?: number;
    proposals: BotSdkJournalProposal[];
    activities: BotSdkJournalActivity[];
};
