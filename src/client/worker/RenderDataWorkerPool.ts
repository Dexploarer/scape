import { ModuleThread, Pool, spawn } from "threads";
import { QueuedTask } from "threads/dist/master/pool";
import { WorkerDescriptor } from "threads/dist/master/pool-types";
import { ObservablePromise } from "threads/dist/observable-promise";

import { LoadedCache } from "../Caches";
import { ObjSpawn } from "../data/obj/ObjSpawn";
import { NpcGeometryData } from "../webgl/loader/NpcGeometryData";
import type { NpcInstance } from "../webgl/npc/NpcRenderTemplate";
import { MinimapData } from "./MinimapData";
import { RenderDataLoader } from "./RenderDataLoader";
import { RenderDataWorker } from "./RenderDataWorker";

type RenderDataWorkerThread = ModuleThread<RenderDataWorker>;

function spawnWorker(): Promise<RenderDataWorkerThread> {
    const worker = new Worker(new URL("./RenderDataWorker", import.meta.url));
    return spawn<RenderDataWorker>(worker);
}

export class RenderDataWorkerPool {
    static create(size: number): RenderDataWorkerPool {
        const pool = Pool(() => spawnWorker(), size);
        const workers = pool["workers"] as WorkerDescriptor<RenderDataWorkerThread>[];
        return new RenderDataWorkerPool(pool, workers, size);
    }

    constructor(
        readonly pool: Pool<RenderDataWorkerThread>,
        readonly workers: WorkerDescriptor<RenderDataWorkerThread>[],
        readonly size: number,
    ) {}

    initCache(cache: LoadedCache, objSpawns: ObjSpawn[], npcInstances: NpcInstance[]): void {
        for (const worker of this.workers) {
            worker.init.then((w) => w.initCache(cache, objSpawns, npcInstances));
        }
    }

    setNpcInstances(instances: NpcInstance[]): Promise<void> {
        const copy = Array.isArray(instances) ? instances.slice() : [];
        return this.runAll((w) => w.setNpcInstances(copy));
    }

    async runAll(task: (w: RenderDataWorkerThread) => any): Promise<void> {
        await Promise.all(this.workers.map((desc) => desc.init.then(task)));
    }

    initLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.runAll((w) => w.initDataLoader(loader));
    }

    resetLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.runAll((w) => w.resetDataLoader(loader));
    }

    queueLoad<I, D, Loader extends RenderDataLoader<I, D>>(
        loader: Loader,
        input: I,
    ): QueuedTask<RenderDataWorkerThread, D> {
        return this.pool.queue((w) => w.load(loader, input) as ObservablePromise<D>);
    }

    queueNpcGeometry(
        mapX: number,
        mapY: number,
        maxLevel: number,
        loadedTextureIds: number[],
    ): QueuedTask<RenderDataWorkerThread, NpcGeometryData> {
        return this.pool.queue(
            (w) =>
                w.loadNpcGeometry(
                    mapX,
                    mapY,
                    maxLevel,
                    loadedTextureIds,
                ) as ObservablePromise<NpcGeometryData>,
        );
    }

    queueLoadTexture(
        id: number,
        size: number,
        flipH: boolean,
        brightness: number,
    ): QueuedTask<RenderDataWorkerThread, Int32Array> {
        return this.pool.queue(
            (w) => w.loadTexture(id, size, flipH, brightness) as ObservablePromise<Int32Array>,
        );
    }

    queueMapImage(
        mapX: number,
        mapY: number,
        level: number,
        drawMapFunctions: boolean,
    ): QueuedTask<RenderDataWorkerThread, MinimapData | undefined> {
        return this.pool.queue((w) => w.loadMapImage(mapX, mapY, level, drawMapFunctions));
    }

    setVars(vars: Int32Array): Promise<void> {
        return this.runAll((w) => w.setVars(vars));
    }

    loadCachedMapImages(): QueuedTask<RenderDataWorkerThread, Map<number, string>> {
        return this.pool.queue((w) => w.loadCachedMapImages());
    }

    exportSprites(): QueuedTask<RenderDataWorkerThread, Blob> {
        return this.pool.queue((w) => w.exportSpritesToZip());
    }

    exportTextures(): QueuedTask<RenderDataWorkerThread, Blob> {
        return this.pool.queue((w) => w.exportTexturesToZip());
    }

    terminate(): Promise<void> {
        return this.pool.terminate();
    }
}
