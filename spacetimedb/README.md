# Shared control plane module

This directory is the first SpacetimeDB control-plane scaffold for hosted `-scape` worlds.

It is intentionally separate from the game server runtime:

-   the world server remains authoritative for the 600ms simulation tick
-   this module is the shared backend shape for hosted worlds, principals, world characters, trajectories, and world-builder metadata

## What lives here

-   `src/index.ts`: canonical SpacetimeDB schema + reducer scaffold
-   `tsconfig.json`: local typecheck gate for the module
-   `types/spacetime-sys.d.ts`: local shim so repo-level TypeScript can validate the module without the Spacetime host runtime

## Local validation

From the repo root:

```sh
bun run spacetimedb:build
bun run spacetimedb:generate:bindings
```

`spacetimedb:build` validates the module shape and keeps CI honest. `spacetimedb:generate:bindings` refreshes the checked-in TypeScript client bindings consumed by the server runtime under `server/src/controlplane/module_bindings/`.

## Publish flow

Publishing still uses the official Spacetime CLI and should happen from this directory:

```sh
cd spacetimedb
spacetime login
spacetime publish <database-name>
```

Once adapters are wired, the game server will target the same shared database via:

-   `SPACETIMEDB_URI`
-   `SPACETIMEDB_DATABASE`
-   `SPACETIMEDB_AUTH_TOKEN`

The active server still uses JSON/Postgres persistence today. This module is the staged control-plane substrate, not the final runtime cutover.
