# 70.8 — Client render overlay

Add a client-side overlay that marks tiles with extra visual information. The current client does **not** use a React hook based overlay registry anymore; overlays are driven by plugin classes under `src/client/plugins/` and rendered through `src/ui/devoverlay/OverlayManager.ts`.

## Where

Use these files as the source of truth:

- `src/client/plugins/grounditems/` — plugin logic fed by ground-item subscriptions.
- `src/client/plugins/tilemarkers/` — user-managed tile markers with sidebar UI.
- `src/client/plugins/interacthighlight/` — hover/target highlighting.
- `src/ui/devoverlay/OverlayManager.ts` — the render-time overlay coordinator.
- `src/client/sidebar/entries.ts` — sidebar registration for shipped client plugins.

## Current pattern

The modern pattern is:

1. Create or extend a plugin class under `src/client/plugins/<name>/`.
2. Subscribe to the relevant server/client state from `src/network/ServerConnection.ts` or `OsrsClient`.
3. Convert that state into overlay data the renderer can consume.
4. Surface plugin settings through `SidebarPlugin.tsx` if the feature is user-configurable.
5. Register the sidebar entry in `src/client/sidebar/entries.ts` if it should appear in the rail.

There is no standalone `useOverlayRegistry()` hook and no `src/ui/plugins/pluginhub/PluginRegistry.ts` file in the current codebase.

## Concrete reference path

If you want a tile-based overlay today:

- Start with `src/client/plugins/tilemarkers/TileMarkersPlugin.ts`.
- Mirror its sidebar wiring from `src/client/plugins/tilemarkers/SidebarPlugin.tsx`.
- Follow how the plugin feeds overlay state into the renderer and how `OverlayManager` draws it.

If you want a state-driven overlay keyed off server updates:

- Start with `src/client/plugins/grounditems/GroundItemsPlugin.ts`.
- Use the exported subscription helpers in `src/network/ServerConnection.ts` (for example `subscribeGroundItems(...)`) instead of a React hook.

## Result

The expected end state is still the same as the old recipe: log in, trigger the underlying condition, and the overlay should appear on the relevant tiles, then disappear when the source state is gone.

## Performance

Tile overlays are cheap but not free. If you end up drawing large numbers of markers every frame, copy the batching approach used by the existing tile-marker style code instead of issuing one immediate-mode draw per tile forever.

## Canonical facts

- **Client plugin root**: `src/client/plugins/`.
- **Sidebar registration**: `src/client/sidebar/entries.ts`.
- **Overlay manager**: `src/ui/devoverlay/OverlayManager.ts`.
- **Ground items reference**: `src/client/plugins/grounditems/`.
- **Tile markers reference**: `src/client/plugins/tilemarkers/`.
- **Server subscriptions**: exported helpers in `src/network/ServerConnection.ts`.
