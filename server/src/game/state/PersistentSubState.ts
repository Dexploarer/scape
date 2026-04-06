/**
 * Interface for domain-specific player state that can be persisted.
 * Each sub-state owns its own serialization/deserialization logic.
 *
 * TSerialize: the shape returned by serialize() (portion of PlayerPersistentVars)
 * TDeserialize: the shape accepted by deserialize() (defaults to TSerialize)
 */
export interface PersistentSubState<TSerialize, TDeserialize = TSerialize> {
    serialize(): TSerialize;
    deserialize(data: TDeserialize | undefined): void;
}
