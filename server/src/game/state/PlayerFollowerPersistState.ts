import type { PlayerFollowerPersistentEntry } from "../player";
import type { PersistentSubState } from "./PersistentSubState";

export class PlayerFollowerPersistState
    implements PersistentSubState<PlayerFollowerPersistentEntry | undefined>
{
    private state?: PlayerFollowerPersistentEntry;
    private activeNpcId?: number;

    getState(): PlayerFollowerPersistentEntry | undefined {
        return this.state;
    }

    setState(value?: PlayerFollowerPersistentEntry): void {
        if (
            !value ||
            !Number.isFinite(value.itemId) ||
            !Number.isFinite(value.npcTypeId) ||
            value.itemId <= 0 ||
            value.npcTypeId <= 0
        ) {
            this.state = undefined;
            return;
        }
        this.state = {
            itemId: value.itemId | 0,
            npcTypeId: value.npcTypeId | 0,
        };
    }

    clearState(): void {
        this.state = undefined;
    }

    getActiveNpcId(): number | undefined {
        return this.activeNpcId;
    }

    setActiveNpcId(npcId: number | undefined): void {
        if (npcId === undefined || !Number.isFinite(npcId) || npcId <= 0) {
            this.activeNpcId = undefined;
            return;
        }
        this.activeNpcId = npcId | 0;
    }

    serialize(): PlayerFollowerPersistentEntry | undefined {
        if (!this.state) return undefined;
        return {
            itemId: this.state.itemId,
            npcTypeId: this.state.npcTypeId,
        };
    }

    deserialize(data: PlayerFollowerPersistentEntry | undefined): void {
        this.setState(data);
        this.activeNpcId = undefined;
    }
}
