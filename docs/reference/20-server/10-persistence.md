# 20.10 — Persistence

Persistence is split into two separate seams:

1. **Authentication records** — usernames, password hashes, ban flags.
2. **Gameplay state** — inventory, bank, skills, varps, collection log, location, and other player vars.

That split is intentional. Account auth can move to Postgres without changing gameplay-state storage, and wiping gameplay state does not have to wipe login credentials.

## `AccountStore` (`server/src/game/state/AccountStore.ts`)

`AccountStore` is the auth-record interface. It provides:

- `verifyOrRegister(username, password)` — verify an existing account or auto-register a new one.
- `exists(username)` — auth-record existence check.
- `size()` — number of known accounts.

The default implementation is `JsonAccountStore`, which stores all auth records in a single JSON file at `config.accountsFilePath` (default `server/data/accounts.json`). If `DATABASE_URL` is set, `createAccountStore()` can switch auth storage to `PostgresAccountStore` instead.

### `AccountRecord`

An auth record is a small object keyed by normalized username:

```json
{
  "username": "shaw",
  "passwordHash": "...",
  "passwordSalt": "...",
  "algorithm": "scrypt-n16384-r8-p1-64",
  "createdAt": 1772688000000,
  "lastLoginAt": 1775370000000,
  "banned": false
}
```

Passwords are hashed with Node's built-in `scrypt`. Plaintext passwords are never persisted.

## `PersistenceProvider` (`server/src/game/state/PersistenceProvider.ts`)

`PersistenceProvider` is the gameplay-state interface. It provides:

- `applyToPlayer(player, key)` — merge persisted state into a live `PlayerState`.
- `hasKey(key)` — whether saved gameplay state exists for that player key.
- `saveSnapshot(key, player)` — write one player's gameplay state immediately.
- `savePlayers(entries)` — bulk-save multiple players during autosave.

The default implementation is `PlayerPersistence`.

## `PlayerPersistence` (`server/src/game/state/PlayerPersistence.ts`)

`PlayerPersistence` is the default JSON gameplay-state backend. `WSServer` constructs it with the current gamemode data dir:

```ts
new PlayerPersistence({
  dataDir: getGamemodeDataDir(this.gamemode.id),
});
```

That means the default files are:

- `server/data/gamemodes/<id>/player-state.json` — saved gameplay state by player key.
- `server/data/gamemodes/<id>/player-defaults.json` — starter/default values merged into new or partially-populated saves.

### Load flow

```
LoginHandshakeService
 ├── accountStore.verifyOrRegister(username, password)
 ├── construct PlayerState
 └── playerPersistence.applyToPlayer(player, key)
      ├── merge player-defaults.json
      ├── merge player-state.json[key]
      └── player.applyPersistentVars(snapshot)
```

### Save flow

```
TickFrameService.runAutosave(...)
 └── persistenceProvider.savePlayers([{ key, player }, ...])
      ├── player.exportPersistentVars()
      ├── sanitize / normalize fields
      └── write player-state.json
```

## Autosave

Autosave runs from `TickFrameService`. Dirty gameplay state is batched and flushed through `PersistenceProvider.savePlayers(...)`. Account auth writes are separate: `JsonAccountStore` writes on account creation and successful login timestamp updates.

## Versioning and compatibility

Gameplay-state compatibility lives in the `PlayerState` import/export path, plus the sanitizers inside `PlayerPersistence`. When you add a new persistent gameplay field:

1. Add it to `PlayerState.exportPersistentVars()` and `PlayerState.applyPersistentVars()`.
2. Give it a safe default when absent.
3. Update the sanitization/merge path in `PlayerPersistence` if the field needs validation.
4. Update tests.

## Backups

For local JSON deployments, back up both:

- `server/data/accounts.json` — auth records.
- `server/data/gamemodes/<id>/player-state.json` — gameplay state.

If auth is moved to Postgres, back up the database plus `player-state.json`.

## Reset / deletion

- Reset auth accounts: delete `server/data/accounts.json` (or the relevant Postgres rows).
- Reset gameplay progress for one gamemode: delete `server/data/gamemodes/<id>/player-state.json`.

Those are separate operations.

---

## Canonical facts

- **Auth record interface**: `server/src/game/state/AccountStore.ts`.
- **Auth store factory**: `server/src/game/state/createAccountStore.ts`.
- **Default auth store**: `JsonAccountStore` in `server/src/game/state/AccountStore.ts`.
- **Optional auth store**: `server/src/game/state/PostgresAccountStore.ts`.
- **Gameplay-state interface**: `server/src/game/state/PersistenceProvider.ts`.
- **Gameplay-state backend**: `server/src/game/state/PlayerPersistence.ts`.
- **Default auth file**: `server/data/accounts.json`.
- **Default gameplay-state file**: `server/data/gamemodes/<id>/player-state.json`.
- **Default gameplay defaults file**: `server/data/gamemodes/<id>/player-defaults.json`.
- **Autosave entrypoint**: `server/src/game/services/TickFrameService.ts`.
- **Rule**: auth and gameplay state are persisted separately.
