import type { PersistentSubState } from "./PersistentSubState";

export interface AccountPersistSnapshot {
    accountStage?: number;
    accountCreationTimeMs?: number;
    playTimeSeconds?: number;
}

export class PlayerAccountState
    implements PersistentSubState<AccountPersistSnapshot>
{
    accountStage: number = 1;
    private creationTimeMs: number = Date.now();
    private lifetimePlayTimeSecondsBase: number = 0;
    private sessionPlayTimeStartedAtMs: number = Date.now();

    getSessionPlayTimeSeconds(nowMs: number = Date.now()): number {
        if (!Number.isFinite(nowMs)) return 0;
        return Math.max(
            0,
            Math.floor((Math.floor(nowMs) - this.sessionPlayTimeStartedAtMs) / 1000),
        );
    }

    getLifetimePlayTimeSeconds(nowMs: number = Date.now()): number {
        const baseSeconds = Math.max(
            0,
            Number.isFinite(this.lifetimePlayTimeSecondsBase)
                ? Math.floor(this.lifetimePlayTimeSecondsBase)
                : 0,
        );
        if (!Number.isFinite(nowMs)) {
            return baseSeconds;
        }
        return Math.max(0, baseSeconds + this.getSessionPlayTimeSeconds(nowMs));
    }

    getAccountAgeMinutes(nowMs: number = Date.now()): number {
        if (!Number.isFinite(nowMs)) return 0;
        return Math.max(0, Math.floor((Math.floor(nowMs) - this.creationTimeMs) / 60000));
    }

    serialize(): AccountPersistSnapshot {
        return {
            accountStage: Number.isFinite(this.accountStage) ? this.accountStage : 1,
            accountCreationTimeMs: Math.max(
                0,
                Number.isFinite(this.creationTimeMs)
                    ? Math.floor(this.creationTimeMs)
                    : 0,
            ),
            playTimeSeconds: this.getLifetimePlayTimeSeconds(),
        };
    }

    deserialize(data: AccountPersistSnapshot | undefined): void {
        if (!data) {
            this.accountStage = 1;
            this.creationTimeMs = Date.now();
            this.lifetimePlayTimeSecondsBase = 0;
            this.sessionPlayTimeStartedAtMs = Date.now();
            return;
        }
        if (data.accountStage !== undefined) {
            this.accountStage = Math.max(0, Math.min(10, data.accountStage));
        }
        this.creationTimeMs =
            data.accountCreationTimeMs !== undefined && data.accountCreationTimeMs >= 0
                ? Math.floor(data.accountCreationTimeMs)
                : Date.now();
        this.lifetimePlayTimeSecondsBase =
            data.playTimeSeconds !== undefined && data.playTimeSeconds >= 0
                ? Math.floor(data.playTimeSeconds)
                : 0;
        this.sessionPlayTimeStartedAtMs = Date.now();
    }
}
