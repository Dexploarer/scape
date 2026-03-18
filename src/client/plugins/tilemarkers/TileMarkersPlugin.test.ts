import { TileMarkersPlugin } from "./TileMarkersPlugin";
import type { TileMarkersPluginConfig, TileMarkersPluginPersistence } from "./types";

describe("TileMarkersPlugin", () => {
    test("defaults to enabled with destination and current tile markers", () => {
        const plugin = new TileMarkersPlugin();

        expect(plugin.getState().config).toEqual({
            enabled: true,
            showDestinationTile: true,
            showCurrentTile: true,
            destinationTileColor: 0xa9a753,
            currentTileColor: 0x808080,
        });
    });

    test("migrates legacy blue destination default to OSRS parity color", () => {
        const persistence: TileMarkersPluginPersistence = {
            load: () => ({
                enabled: true,
                showDestinationTile: true,
                showCurrentTile: true,
                destinationTileColor: 0x0000ff,
                currentTileColor: 0x808080,
            }),
            save: () => {},
        };
        const plugin = new TileMarkersPlugin(persistence);

        expect(plugin.getState().config).toEqual({
            enabled: true,
            showDestinationTile: true,
            showCurrentTile: true,
            destinationTileColor: 0xa9a753,
            currentTileColor: 0x808080,
        });
    });

    test("loads persisted config", () => {
        const persistence: TileMarkersPluginPersistence = {
            load: () => ({
                enabled: false,
                showDestinationTile: false,
                showCurrentTile: true,
                destinationTileColor: 0x3366ff,
                currentTileColor: 0x999999,
            }),
            save: () => {},
        };
        const plugin = new TileMarkersPlugin(persistence);

        expect(plugin.getState().config).toEqual({
            enabled: false,
            showDestinationTile: false,
            showCurrentTile: true,
            destinationTileColor: 0x3366ff,
            currentTileColor: 0x999999,
        });
    });

    test("persists config updates", () => {
        let saved: TileMarkersPluginConfig | undefined;
        const persistence: TileMarkersPluginPersistence = {
            load: () => undefined,
            save: (config) => {
                saved = config;
            },
        };
        const plugin = new TileMarkersPlugin(persistence);

        plugin.setConfig({
            enabled: false,
            showDestinationTile: false,
            showCurrentTile: false,
            destinationTileColor: 0x1234ab,
            currentTileColor: 0x556677,
        });

        expect(saved).toEqual({
            enabled: false,
            showDestinationTile: false,
            showCurrentTile: false,
            destinationTileColor: 0x1234ab,
            currentTileColor: 0x556677,
        });
    });
});
