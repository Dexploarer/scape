import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

import { readDoorCatalog, writeDoorCatalog } from "../src/world/DoorCatalogFile";
import { DoorDefinitionLoader } from "../src/world/DoorDefinitionLoader";
import { DoorRuntimeTileMappingStore } from "../src/world/DoorRuntimeTileMappingStore";

function main(): void {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "door-catalog-"));
    const filePath = path.join(tempDir, "doors.json");

    writeDoorCatalog(filePath, {
        version: 1,
        definitions: {
            singleDoors: [{ closed: 10, opened: 11 }],
            doubleDoors: [
                {
                    closed: { left: 20, right: 21 },
                    opened: { left: 22, right: 23 },
                },
            ],
            gates: [
                {
                    closed: { hinge: 30, extension: 31 },
                    opened: { hinge: 32, extension: 33 },
                },
            ],
        },
        runtimeTileMappings: {
            version: 1,
            generatedAt: new Date(0).toISOString(),
            entries: [],
        },
    });

    const loader = new DoorDefinitionLoader(filePath, false);
    assert.deepStrictEqual(loader.getSingleDoorPair(10), { closed: 10, opened: 11 });
    assert.deepStrictEqual(loader.getDoubleDoorDef(20), {
        closed: { left: 20, right: 21 },
        opened: { left: 22, right: 23 },
    });
    assert.deepStrictEqual(loader.getGateDef(30), {
        closed: { hinge: 30, extension: 31 },
        opened: { hinge: 32, extension: 33 },
    });

    const runtime = new DoorRuntimeTileMappingStore(filePath, 10);
    runtime.recordObservedPair(0, 3200, 3201, 40, 41);
    runtime.flushNow();
    runtime.dispose();

    const catalog = readDoorCatalog(filePath);
    assert.deepStrictEqual(catalog.definitions.singleDoors, [{ closed: 10, opened: 11 }]);
    assert.deepStrictEqual(catalog.definitions.doubleDoors, [
        {
            closed: { left: 20, right: 21 },
            opened: { left: 22, right: 23 },
        },
    ]);
    assert.deepStrictEqual(catalog.definitions.gates, [
        {
            closed: { hinge: 30, extension: 31 },
            opened: { hinge: 32, extension: 33 },
        },
    ]);
    assert.strictEqual(catalog.runtimeTileMappings.entries.length, 1);
    assert.deepStrictEqual(catalog.runtimeTileMappings.entries[0], {
        level: 0,
        x: 3200,
        y: 3201,
        pairs: [
            {
                closed: 40,
                opened: 41,
                count: 1,
                lastObserved: catalog.runtimeTileMappings.entries[0].pairs[0].lastObserved,
            },
        ],
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
}

main();
