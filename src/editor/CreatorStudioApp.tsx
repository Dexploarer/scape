import {
    type ChangeEvent,
    startTransition,
    useDeferredValue,
    useEffect,
    useMemo,
    useState,
} from "react";

import { fetchCacheList } from "../client/Caches";
import { getMapImageBasePath } from "../client/assetSources";
import { WorldMap } from "../components/rs/worldmap/WorldMap";
import type { WorldMapMarker } from "../components/rs/worldmap/WorldMap";
import "./CreatorStudio.css";
import {
    type CreatorStudioProject,
    type QuestAction,
    type QuestActionKind,
    type QuestDialogueLine,
    type QuestProject,
    type QuestStage,
    type QuestTrigger,
    type QuestTriggerKind,
    type TemplateChunkPlacement,
    type WorldEditTool,
    type WorldLocPlacement,
    type WorldNpcSpawn,
    createEmptyCreatorStudioProject,
    createEmptyQuest,
    createEmptyQuestStage,
    normalizeCreatorStudioProject,
    serializeCreatorStudioProject,
    slugifyProjectId,
    summarizeWorldProject,
    templateChunkPlacementFromTile,
    upsertTemplateChunkPlacement,
} from "./projectSchema";

const CREATOR_STORAGE_KEY = "creator_studio_project_v1";

type Workspace = "world" | "quests" | "json";

type TemplateSelection = {
    plane: number;
    chunkX: number;
    chunkY: number;
};

type LocBrush = {
    locId: number;
    level: number;
    type: number;
    rotation: number;
    label: string;
};

type NpcBrush = {
    npcId: number;
    level: number;
    wanderRadius: number;
    label: string;
};

const QUEST_TRIGGER_OPTIONS: QuestTriggerKind[] = [
    "npc_interaction",
    "loc_interaction",
    "item_on_loc",
    "widget_action",
    "region_enter",
    "varp_value",
    "varbit_value",
];

const QUEST_ACTION_OPTIONS: QuestActionKind[] = [
    "dialogue",
    "set_varp",
    "set_varbit",
    "spawn_loc",
    "remove_loc",
    "give_item",
    "teleport",
];

function loadProjectFromStorage(): CreatorStudioProject {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
        return createEmptyCreatorStudioProject();
    }
    try {
        const raw = window.localStorage.getItem(CREATOR_STORAGE_KEY);
        if (!raw) {
            return createEmptyCreatorStudioProject();
        }
        return normalizeCreatorStudioProject(JSON.parse(raw));
    } catch {
        return createEmptyCreatorStudioProject();
    }
}

function saveProjectToStorage(project: CreatorStudioProject): void {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(CREATOR_STORAGE_KEY, serializeCreatorStudioProject(project));
    } catch {}
}

function downloadProject(project: CreatorStudioProject): void {
    const text = serializeCreatorStudioProject(project);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.world.id || "creator_project"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function parseMultilineList(raw: string): string[] {
    return raw
        .split("\n")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function formatMultilineList(values: string[]): string {
    return values.join("\n");
}

function createTrigger(index: number): QuestTrigger {
    return {
        id: `trigger_${Date.now()}_${index}`,
        kind: "npc_interaction",
        target: "",
        value: "Talk-to",
    };
}

function createAction(index: number): QuestAction {
    return {
        id: `action_${Date.now()}_${index}`,
        kind: "dialogue",
        target: "",
        value: "",
    };
}

function createDialogueLine(index: number): QuestDialogueLine {
    return {
        id: `dialogue_${Date.now()}_${index}`,
        speaker: "NPC",
        text: "",
    };
}

function NumberField({
    label,
    value,
    onChange,
    min,
    max,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}): JSX.Element {
    return (
        <label className="creator-field">
            <span>{label}</span>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(event) => onChange(parseInt(event.target.value || "0", 10) || 0)}
            />
        </label>
    );
}

function TextField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}): JSX.Element {
    return (
        <label className="creator-field">
            <span>{label}</span>
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

function TextAreaField({
    label,
    value,
    onChange,
    rows = 4,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    placeholder?: string;
}): JSX.Element {
    return (
        <label className="creator-field">
            <span>{label}</span>
            <textarea
                rows={rows}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

function updateQuest(
    project: CreatorStudioProject,
    questId: string,
    updater: (quest: QuestProject) => QuestProject,
): CreatorStudioProject {
    return {
        ...project,
        quests: project.quests.map((quest) => (quest.id === questId ? updater(quest) : quest)),
    };
}

function updateStage(
    project: CreatorStudioProject,
    questId: string,
    stageId: string,
    updater: (stage: QuestStage) => QuestStage,
): CreatorStudioProject {
    return updateQuest(project, questId, (quest) => ({
        ...quest,
        stages: quest.stages.map((stage) => (stage.id === stageId ? updater(stage) : stage)),
    }));
}

function WorldPlacementList({
    title,
    items,
    selectedId,
    onSelect,
    onRemove,
    renderLabel,
}: {
    title: string;
    items: Array<TemplateChunkPlacement | WorldLocPlacement | WorldNpcSpawn>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRemove: (id: string) => void;
    renderLabel: (item: TemplateChunkPlacement | WorldLocPlacement | WorldNpcSpawn) => string;
}): JSX.Element {
    return (
        <section className="creator-card creator-card-tight">
            <div className="creator-section-heading">
                <h3>{title}</h3>
                <span>{items.length}</span>
            </div>
            <div className="creator-entity-list">
                {items.length === 0 ? (
                    <div className="creator-empty-state">Nothing placed yet.</div>
                ) : null}
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`creator-entity-row${selectedId === item.id ? " selected" : ""}`}
                    >
                        <button
                            type="button"
                            className="creator-entity-select"
                            onClick={() => onSelect(item.id)}
                        >
                            {renderLabel(item)}
                        </button>
                        <button
                            type="button"
                            className="creator-entity-remove"
                            onClick={() => onRemove(item.id)}
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}

function TemplateGrid({
    plane,
    world,
    selected,
    onSelect,
}: {
    plane: number;
    world: CreatorStudioProject["world"];
    selected: TemplateSelection;
    onSelect: (selection: TemplateSelection) => void;
}): JSX.Element {
    const placementMap = useMemo(() => {
        const map = new Map<string, TemplateChunkPlacement>();
        for (const entry of world.templateChunks) {
            if (entry.destPlane !== plane) continue;
            map.set(`${entry.destChunkX}:${entry.destChunkY}`, entry);
        }
        return map;
    }, [plane, world.templateChunks]);

    const cells: JSX.Element[] = [];
    for (let chunkY = 0; chunkY < 13; chunkY++) {
        for (let chunkX = 0; chunkX < 13; chunkX++) {
            const entry = placementMap.get(`${chunkX}:${chunkY}`);
            const isSelected =
                selected.plane === plane &&
                selected.chunkX === chunkX &&
                selected.chunkY === chunkY;
            cells.push(
                <button
                    key={`${chunkX}:${chunkY}`}
                    type="button"
                    className={`creator-grid-cell${entry ? " filled" : ""}${
                        isSelected ? " selected" : ""
                    }`}
                    onClick={() => onSelect({ plane, chunkX, chunkY })}
                >
                    <span>
                        {chunkX},{chunkY}
                    </span>
                    <strong>
                        {entry ? `${entry.sourceChunkX},${entry.sourceChunkY}` : "Empty"}
                    </strong>
                </button>,
            );
        }
    }

    return <div className="creator-grid">{cells}</div>;
}

function CreatorStudioApp(): JSX.Element {
    const [project, setProject] = useState<CreatorStudioProject>(() => loadProjectFromStorage());
    const [workspace, setWorkspace] = useState<Workspace>("world");
    const [selectedQuestId, setSelectedQuestId] = useState<string>(
        () => loadProjectFromStorage().quests[0]?.id ?? "",
    );
    const [selectedStageId, setSelectedStageId] = useState<string>(
        () => loadProjectFromStorage().quests[0]?.stages[0]?.id ?? "",
    );
    const [selectedTool, setSelectedTool] = useState<WorldEditTool>("template");
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateSelection>({
        plane: 0,
        chunkX: 6,
        chunkY: 6,
    });
    const [templateSourcePlane, setTemplateSourcePlane] = useState(0);
    const [templateRotation, setTemplateRotation] = useState(0);
    const [locBrush, setLocBrush] = useState<LocBrush>({
        locId: 100,
        level: 0,
        type: 10,
        rotation: 0,
        label: "",
    });
    const [npcBrush, setNpcBrush] = useState<NpcBrush>({
        npcId: 100,
        level: 0,
        wanderRadius: 0,
        label: "",
    });
    const [selectedWorldEntityId, setSelectedWorldEntityId] = useState<string | null>(null);
    const [latestCacheName, setLatestCacheName] = useState("");
    const [ioStatus, setIoStatus] = useState("Local autosave is active.");

    useEffect(() => {
        saveProjectToStorage(project);
    }, [project]);

    useEffect(() => {
        let mounted = true;
        fetchCacheList()
            .then((list) => {
                if (!mounted || !list?.latest?.name) return;
                setLatestCacheName(list.latest.name);
                setProject((current) =>
                    current.world.cacheName
                        ? current
                        : {
                              ...current,
                              world: {
                                  ...current.world,
                                  cacheName: list.latest.name,
                              },
                          },
                );
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    const deferredProject = useDeferredValue(project);
    const serializedProject = useMemo(
        () => serializeCreatorStudioProject(deferredProject),
        [deferredProject],
    );
    const worldSummary = useMemo(() => summarizeWorldProject(project.world), [project.world]);
    const mapImageBasePath = useMemo(() => {
        const cacheName = project.world.cacheName || latestCacheName;
        return cacheName ? getMapImageBasePath(cacheName) : "";
    }, [latestCacheName, project.world.cacheName]);
    const selectedQuest =
        project.quests.find((quest) => quest.id === selectedQuestId) ?? project.quests[0] ?? null;
    const selectedStage =
        selectedQuest?.stages.find((stage) => stage.id === selectedStageId) ??
        selectedQuest?.stages[0] ??
        null;

    useEffect(() => {
        if (!selectedQuest && project.quests[0]) {
            setSelectedQuestId(project.quests[0].id);
        }
    }, [project.quests, selectedQuest]);

    useEffect(() => {
        if (!selectedQuest) return;
        const nextStage = selectedQuest.stages.find((stage) => stage.id === selectedStageId);
        if (!nextStage && selectedQuest.stages[0]) {
            setSelectedStageId(selectedQuest.stages[0].id);
        }
    }, [selectedQuest, selectedStageId]);

    const mapMarkers = useMemo<WorldMapMarker[]>(() => {
        const markers: WorldMapMarker[] = [
            {
                id: "origin",
                x: project.world.origin.x,
                y: project.world.origin.y,
                label: "World origin",
                tone: "gold",
                selected: selectedWorldEntityId === "origin",
            },
        ];
        for (const loc of project.world.locPlacements) {
            markers.push({
                id: loc.id,
                x: loc.x,
                y: loc.y,
                label: loc.label || `Loc ${loc.locId}`,
                tone: "cyan",
                selected: selectedWorldEntityId === loc.id,
            });
        }
        for (const npc of project.world.npcSpawns) {
            markers.push({
                id: npc.id,
                x: npc.x,
                y: npc.y,
                label: npc.label || `NPC ${npc.npcId}`,
                tone: "rose",
                selected: selectedWorldEntityId === npc.id,
            });
        }
        return markers;
    }, [project.world, selectedWorldEntityId]);

    const mapKey = `${project.world.origin.x}:${project.world.origin.y}:${project.world.origin.level}:${mapImageBasePath}`;

    const setWorld = (
        updater: (world: CreatorStudioProject["world"]) => CreatorStudioProject["world"],
    ) => {
        setProject((current) => ({
            ...current,
            world: updater(current.world),
        }));
    };

    const handleMapClick = (x: number, y: number) => {
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);

        if (selectedTool === "template") {
            const placement = templateChunkPlacementFromTile(
                {
                    destPlane: selectedTemplate.plane,
                    destChunkX: selectedTemplate.chunkX,
                    destChunkY: selectedTemplate.chunkY,
                    rotation: templateRotation,
                },
                {
                    x: tileX,
                    y: tileY,
                    level: templateSourcePlane,
                },
            );
            setWorld((world) => upsertTemplateChunkPlacement(world, placement));
            setSelectedWorldEntityId(placement.id);
            setIoStatus(
                `Mapped template cell ${selectedTemplate.chunkX},${selectedTemplate.chunkY} on plane ${selectedTemplate.plane}.`,
            );
            return;
        }

        if (selectedTool === "loc") {
            const id = `loc_${Date.now()}`;
            setWorld((world) => ({
                ...world,
                locPlacements: [
                    ...world.locPlacements,
                    {
                        id,
                        locId: locBrush.locId,
                        x: tileX,
                        y: tileY,
                        level: locBrush.level,
                        type: locBrush.type,
                        rotation: locBrush.rotation,
                        label: locBrush.label,
                    },
                ],
            }));
            setSelectedWorldEntityId(id);
            setIoStatus(`Placed loc ${locBrush.locId} at ${tileX},${tileY},${locBrush.level}.`);
            return;
        }

        const id = `npc_${Date.now()}`;
        setWorld((world) => ({
            ...world,
            npcSpawns: [
                ...world.npcSpawns,
                {
                    id,
                    npcId: npcBrush.npcId,
                    x: tileX,
                    y: tileY,
                    level: npcBrush.level,
                    wanderRadius: npcBrush.wanderRadius,
                    label: npcBrush.label,
                },
            ],
        }));
        setSelectedWorldEntityId(id);
        setIoStatus(`Placed NPC ${npcBrush.npcId} at ${tileX},${tileY},${npcBrush.level}.`);
    };

    const onImportProject = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const imported = normalizeCreatorStudioProject(JSON.parse(text));
            startTransition(() => {
                setProject(imported);
                setSelectedQuestId(imported.quests[0]?.id ?? "");
                setSelectedStageId(imported.quests[0]?.stages[0]?.id ?? "");
                setSelectedWorldEntityId(null);
            });
            setIoStatus(`Imported ${file.name}.`);
        } catch {
            setIoStatus(`Failed to import ${file.name}.`);
        } finally {
            event.target.value = "";
        }
    };

    const removeTemplatePlacement = (id: string) => {
        setWorld((world) => ({
            ...world,
            templateChunks: world.templateChunks.filter((entry) => entry.id !== id),
        }));
        if (selectedWorldEntityId === id) {
            setSelectedWorldEntityId(null);
        }
    };

    const removeLocPlacement = (id: string) => {
        setWorld((world) => ({
            ...world,
            locPlacements: world.locPlacements.filter((entry) => entry.id !== id),
        }));
        if (selectedWorldEntityId === id) {
            setSelectedWorldEntityId(null);
        }
    };

    const removeNpcSpawn = (id: string) => {
        setWorld((world) => ({
            ...world,
            npcSpawns: world.npcSpawns.filter((entry) => entry.id !== id),
        }));
        if (selectedWorldEntityId === id) {
            setSelectedWorldEntityId(null);
        }
    };

    const selectedPlacement =
        project.world.templateChunks.find((entry) => entry.id === selectedWorldEntityId) ??
        project.world.locPlacements.find((entry) => entry.id === selectedWorldEntityId) ??
        project.world.npcSpawns.find((entry) => entry.id === selectedWorldEntityId) ??
        null;

    const addQuest = () => {
        const nextQuest = createEmptyQuest(project.quests.length + 1);
        setProject((current) => ({
            ...current,
            quests: [...current.quests, nextQuest],
        }));
        setSelectedQuestId(nextQuest.id);
        setSelectedStageId(nextQuest.stages[0]?.id ?? "");
        setWorkspace("quests");
    };

    const removeQuest = (questId: string) => {
        setProject((current) => {
            const quests = current.quests.filter((quest) => quest.id !== questId);
            return {
                ...current,
                quests: quests.length > 0 ? quests : [createEmptyQuest(1)],
            };
        });
    };

    const addStage = () => {
        if (!selectedQuest) return;
        const nextStage = createEmptyQuestStage(selectedQuest.stages.length + 1);
        setProject((current) =>
            updateQuest(current, selectedQuest.id, (quest) => ({
                ...quest,
                stages: [...quest.stages, nextStage],
            })),
        );
        setSelectedStageId(nextStage.id);
    };

    const removeStage = (stageId: string) => {
        if (!selectedQuest) return;
        setProject((current) =>
            updateQuest(current, selectedQuest.id, (quest) => {
                const stages = quest.stages.filter((stage) => stage.id !== stageId);
                const safeStages = stages.length > 0 ? stages : [createEmptyQuestStage(1)];
                return {
                    ...quest,
                    stages: safeStages,
                    startStageId:
                        quest.startStageId === stageId ? safeStages[0].id : quest.startStageId,
                };
            }),
        );
    };

    const setQuestField = <K extends keyof QuestProject>(key: K, value: QuestProject[K]) => {
        if (!selectedQuest) return;
        setProject((current) =>
            updateQuest(current, selectedQuest.id, (quest) => ({
                ...quest,
                [key]: value,
            })),
        );
    };

    const setStageField = <K extends keyof QuestStage>(key: K, value: QuestStage[K]) => {
        if (!selectedQuest || !selectedStage) return;
        setProject((current) =>
            updateStage(current, selectedQuest.id, selectedStage.id, (stage) => ({
                ...stage,
                [key]: value,
            })),
        );
    };

    const setStageCollection = <T extends QuestTrigger | QuestAction | QuestDialogueLine>(
        key: "triggers" | "actions" | "dialogue",
        value: T[],
    ) => {
        if (!selectedQuest || !selectedStage) return;
        setProject((current) =>
            updateStage(current, selectedQuest.id, selectedStage.id, (stage) => ({
                ...stage,
                [key]: value,
            })),
        );
    };

    return (
        <div className="creator-root">
            <header className="creator-header">
                <div>
                    <p className="creator-kicker">Editor Route</p>
                    <h1>Creator Studio</h1>
                    <p className="creator-header-copy">
                        Build world definitions with template chunks, loc placements, and NPC
                        spawns, then author quests that compile cleanly into script triggers, varp
                        state, and dialogue flows.
                    </p>
                </div>
                <div className="creator-header-actions">
                    <a className="creator-link-button" href="/">
                        Open Client
                    </a>
                    <button
                        type="button"
                        className="creator-link-button"
                        onClick={() => downloadProject(project)}
                    >
                        Export JSON
                    </button>
                    <label className="creator-link-button file-button">
                        Import JSON
                        <input type="file" accept="application/json" onChange={onImportProject} />
                    </label>
                </div>
            </header>

            <section className="creator-toolbar">
                <div className="creator-workspace-tabs">
                    {(["world", "quests", "json"] as Workspace[]).map((entry) => (
                        <button
                            key={entry}
                            type="button"
                            className={workspace === entry ? "active" : ""}
                            onClick={() => setWorkspace(entry)}
                        >
                            {entry === "world"
                                ? "World Builder"
                                : entry === "quests"
                                ? "Quest Builder"
                                : "JSON"}
                        </button>
                    ))}
                </div>
                <div className="creator-status">{ioStatus}</div>
            </section>

            {workspace === "world" ? (
                <div className="creator-layout creator-layout-world">
                    <section className="creator-card creator-world-canvas">
                        <div className="creator-section-heading">
                            <h2>World Construction</h2>
                            <span>
                                {project.world.cacheName || latestCacheName || "No cache selected"}
                            </span>
                        </div>
                        <div className="creator-map-shell">
                            <WorldMap
                                key={mapKey}
                                onDoubleClick={handleMapClick}
                                getPosition={() => ({
                                    x: project.world.origin.x,
                                    y: project.world.origin.y,
                                })}
                                loadMapImageUrl={(mapX, mapY) =>
                                    mapImageBasePath
                                        ? `${mapImageBasePath}/${mapX}_${mapY}.png`
                                        : undefined
                                }
                                markers={mapMarkers}
                                interactionLabel={`Click to ${
                                    selectedTool === "template"
                                        ? "map a template chunk"
                                        : selectedTool === "loc"
                                        ? "place a loc"
                                        : "place an NPC spawn"
                                }`}
                            />
                        </div>
                    </section>

                    <section className="creator-card">
                        <div className="creator-section-heading">
                            <h2>World Metadata</h2>
                            <span>{worldSummary.regionIds.length} regions</span>
                        </div>
                        <div className="creator-form-grid">
                            <TextField
                                label="World name"
                                value={project.world.name}
                                onChange={(value) =>
                                    setWorld((world) => ({
                                        ...world,
                                        name: value,
                                        id: slugifyProjectId(value, world.id || "new_world"),
                                    }))
                                }
                            />
                            <TextField
                                label="World id"
                                value={project.world.id}
                                onChange={(value) =>
                                    setWorld((world) => ({
                                        ...world,
                                        id: slugifyProjectId(value, "new_world"),
                                    }))
                                }
                            />
                            <TextField
                                label="Cache name"
                                value={project.world.cacheName}
                                onChange={(value) =>
                                    setWorld((world) => ({
                                        ...world,
                                        cacheName: value,
                                    }))
                                }
                                placeholder={latestCacheName}
                            />
                            <NumberField
                                label="Origin X"
                                value={project.world.origin.x}
                                onChange={(value) =>
                                    setWorld((world) => ({
                                        ...world,
                                        origin: { ...world.origin, x: value },
                                    }))
                                }
                            />
                            <NumberField
                                label="Origin Y"
                                value={project.world.origin.y}
                                onChange={(value) =>
                                    setWorld((world) => ({
                                        ...world,
                                        origin: { ...world.origin, y: value },
                                    }))
                                }
                            />
                            <NumberField
                                label="Origin level"
                                value={project.world.origin.level}
                                min={0}
                                max={3}
                                onChange={(value) =>
                                    setWorld((world) => ({
                                        ...world,
                                        origin: {
                                            ...world.origin,
                                            level: Math.max(0, Math.min(3, value)),
                                        },
                                    }))
                                }
                            />
                        </div>
                        <TextAreaField
                            label="Description"
                            value={project.world.description}
                            onChange={(value) =>
                                setWorld((world) => ({
                                    ...world,
                                    description: value,
                                }))
                            }
                            rows={3}
                        />

                        <div className="creator-summary-grid">
                            <div>
                                <span>Template chunks</span>
                                <strong>{worldSummary.templateChunkCount}</strong>
                            </div>
                            <div>
                                <span>Loc placements</span>
                                <strong>{worldSummary.locCount}</strong>
                            </div>
                            <div>
                                <span>NPC spawns</span>
                                <strong>{worldSummary.npcCount}</strong>
                            </div>
                            <div>
                                <span>Referenced regions</span>
                                <strong>{worldSummary.regionIds.length}</strong>
                            </div>
                        </div>
                        <div className="creator-region-pillbox">
                            {worldSummary.regionIds.map((regionId) => (
                                <span key={regionId} className="creator-pill">
                                    {regionId}
                                </span>
                            ))}
                        </div>
                    </section>

                    <section className="creator-card">
                        <div className="creator-section-heading">
                            <h2>Brushes</h2>
                            <span>{selectedTool}</span>
                        </div>
                        <div className="creator-workspace-tabs creator-tool-tabs">
                            {(["template", "loc", "npc"] as WorldEditTool[]).map((tool) => (
                                <button
                                    key={tool}
                                    type="button"
                                    className={selectedTool === tool ? "active" : ""}
                                    onClick={() => setSelectedTool(tool)}
                                >
                                    {tool === "template"
                                        ? "Template Chunks"
                                        : tool === "loc"
                                        ? "Locs"
                                        : "NPCs"}
                                </button>
                            ))}
                        </div>

                        {selectedTool === "template" ? (
                            <>
                                <div className="creator-form-grid">
                                    <NumberField
                                        label="Dest plane"
                                        value={selectedTemplate.plane}
                                        min={0}
                                        max={3}
                                        onChange={(value) =>
                                            setSelectedTemplate((current) => ({
                                                ...current,
                                                plane: Math.max(0, Math.min(3, value)),
                                            }))
                                        }
                                    />
                                    <NumberField
                                        label="Source plane"
                                        value={templateSourcePlane}
                                        min={0}
                                        max={3}
                                        onChange={(value) =>
                                            setTemplateSourcePlane(Math.max(0, Math.min(3, value)))
                                        }
                                    />
                                    <NumberField
                                        label="Rotation"
                                        value={templateRotation}
                                        min={0}
                                        max={3}
                                        onChange={(value) =>
                                            setTemplateRotation(Math.max(0, Math.min(3, value)))
                                        }
                                    />
                                </div>
                                <p className="creator-help-copy">
                                    Select a destination cell, then click the world map to source an
                                    8×8 chunk from the cache world.
                                </p>
                                <TemplateGrid
                                    plane={selectedTemplate.plane}
                                    world={project.world}
                                    selected={selectedTemplate}
                                    onSelect={setSelectedTemplate}
                                />
                            </>
                        ) : null}

                        {selectedTool === "loc" ? (
                            <div className="creator-form-grid">
                                <NumberField
                                    label="Loc id"
                                    value={locBrush.locId}
                                    onChange={(value) =>
                                        setLocBrush((current) => ({ ...current, locId: value }))
                                    }
                                />
                                <NumberField
                                    label="Level"
                                    value={locBrush.level}
                                    min={0}
                                    max={3}
                                    onChange={(value) =>
                                        setLocBrush((current) => ({
                                            ...current,
                                            level: Math.max(0, Math.min(3, value)),
                                        }))
                                    }
                                />
                                <NumberField
                                    label="Type"
                                    value={locBrush.type}
                                    onChange={(value) =>
                                        setLocBrush((current) => ({ ...current, type: value }))
                                    }
                                />
                                <NumberField
                                    label="Rotation"
                                    value={locBrush.rotation}
                                    min={0}
                                    max={3}
                                    onChange={(value) =>
                                        setLocBrush((current) => ({
                                            ...current,
                                            rotation: Math.max(0, Math.min(3, value)),
                                        }))
                                    }
                                />
                                <TextField
                                    label="Label"
                                    value={locBrush.label}
                                    onChange={(value) =>
                                        setLocBrush((current) => ({ ...current, label: value }))
                                    }
                                />
                            </div>
                        ) : null}

                        {selectedTool === "npc" ? (
                            <div className="creator-form-grid">
                                <NumberField
                                    label="NPC id"
                                    value={npcBrush.npcId}
                                    onChange={(value) =>
                                        setNpcBrush((current) => ({ ...current, npcId: value }))
                                    }
                                />
                                <NumberField
                                    label="Level"
                                    value={npcBrush.level}
                                    min={0}
                                    max={3}
                                    onChange={(value) =>
                                        setNpcBrush((current) => ({
                                            ...current,
                                            level: Math.max(0, Math.min(3, value)),
                                        }))
                                    }
                                />
                                <NumberField
                                    label="Wander radius"
                                    value={npcBrush.wanderRadius}
                                    onChange={(value) =>
                                        setNpcBrush((current) => ({
                                            ...current,
                                            wanderRadius: Math.max(0, value),
                                        }))
                                    }
                                />
                                <TextField
                                    label="Label"
                                    value={npcBrush.label}
                                    onChange={(value) =>
                                        setNpcBrush((current) => ({ ...current, label: value }))
                                    }
                                />
                            </div>
                        ) : null}
                    </section>

                    <section className="creator-card creator-card-stack">
                        <WorldPlacementList
                            title="Template Placements"
                            items={project.world.templateChunks}
                            selectedId={selectedWorldEntityId}
                            onSelect={setSelectedWorldEntityId}
                            onRemove={removeTemplatePlacement}
                            renderLabel={(item) => {
                                const chunk = item as TemplateChunkPlacement;
                                return `P${chunk.destPlane} ${chunk.destChunkX},${chunk.destChunkY} -> ${chunk.sourceChunkX},${chunk.sourceChunkY}`;
                            }}
                        />
                        <WorldPlacementList
                            title="Loc Placements"
                            items={project.world.locPlacements}
                            selectedId={selectedWorldEntityId}
                            onSelect={setSelectedWorldEntityId}
                            onRemove={removeLocPlacement}
                            renderLabel={(item) => {
                                const loc = item as WorldLocPlacement;
                                return `${loc.label || `Loc ${loc.locId}`} @ ${loc.x},${loc.y},${
                                    loc.level
                                }`;
                            }}
                        />
                        <WorldPlacementList
                            title="NPC Spawns"
                            items={project.world.npcSpawns}
                            selectedId={selectedWorldEntityId}
                            onSelect={setSelectedWorldEntityId}
                            onRemove={removeNpcSpawn}
                            renderLabel={(item) => {
                                const npc = item as WorldNpcSpawn;
                                return `${npc.label || `NPC ${npc.npcId}`} @ ${npc.x},${npc.y},${
                                    npc.level
                                }`;
                            }}
                        />
                    </section>

                    <section className="creator-card">
                        <div className="creator-section-heading">
                            <h2>Selection</h2>
                            <span>{selectedPlacement ? selectedPlacement.id : "None"}</span>
                        </div>
                        {selectedPlacement ? (
                            <pre className="creator-code-panel">
                                {JSON.stringify(selectedPlacement, null, 2)}
                            </pre>
                        ) : (
                            <div className="creator-empty-state">
                                Select a placed entity or map the next template chunk.
                            </div>
                        )}
                    </section>
                </div>
            ) : null}

            {workspace === "quests" ? (
                <div className="creator-layout creator-layout-quests">
                    <section className="creator-card creator-card-tight">
                        <div className="creator-section-heading">
                            <h2>Quests</h2>
                            <button
                                type="button"
                                className="creator-inline-button"
                                onClick={addQuest}
                            >
                                Add Quest
                            </button>
                        </div>
                        <div className="creator-quest-list">
                            {project.quests.map((quest) => (
                                <div
                                    key={quest.id}
                                    className={`creator-quest-row${
                                        selectedQuest?.id === quest.id ? " selected" : ""
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="creator-quest-select"
                                        onClick={() => {
                                            setSelectedQuestId(quest.id);
                                            setSelectedStageId(quest.stages[0]?.id ?? "");
                                        }}
                                    >
                                        {quest.name}
                                    </button>
                                    <button
                                        type="button"
                                        className="creator-entity-remove"
                                        onClick={() => removeQuest(quest.id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="creator-card">
                        <div className="creator-section-heading">
                            <h2>Quest Metadata</h2>
                            <span>{selectedQuest?.id ?? "No quest"}</span>
                        </div>
                        {selectedQuest ? (
                            <>
                                <div className="creator-form-grid">
                                    <TextField
                                        label="Quest name"
                                        value={selectedQuest.name}
                                        onChange={(value) => setQuestField("name", value)}
                                    />
                                    <TextField
                                        label="Quest id"
                                        value={selectedQuest.id}
                                        onChange={(value) =>
                                            setProject((current) =>
                                                updateQuest(current, selectedQuest.id, (quest) => ({
                                                    ...quest,
                                                    id: slugifyProjectId(value, quest.id),
                                                })),
                                            )
                                        }
                                    />
                                    <TextField
                                        label="Start stage id"
                                        value={selectedQuest.startStageId}
                                        onChange={(value) => setQuestField("startStageId", value)}
                                    />
                                </div>
                                <TextAreaField
                                    label="Description"
                                    value={selectedQuest.description}
                                    onChange={(value) => setQuestField("description", value)}
                                    rows={3}
                                />
                                <TextAreaField
                                    label="Prerequisites"
                                    value={formatMultilineList(selectedQuest.prerequisites)}
                                    onChange={(value) =>
                                        setQuestField("prerequisites", parseMultilineList(value))
                                    }
                                    rows={3}
                                    placeholder="Quest ids or notes, one per line"
                                />
                                <TextAreaField
                                    label="Rewards"
                                    value={formatMultilineList(selectedQuest.rewards)}
                                    onChange={(value) =>
                                        setQuestField("rewards", parseMultilineList(value))
                                    }
                                    rows={3}
                                    placeholder="Reward definitions, one per line"
                                />
                            </>
                        ) : null}
                    </section>

                    <section className="creator-card">
                        <div className="creator-section-heading">
                            <h2>Stages</h2>
                            <button
                                type="button"
                                className="creator-inline-button"
                                onClick={addStage}
                            >
                                Add Stage
                            </button>
                        </div>
                        <div className="creator-stage-list">
                            {selectedQuest?.stages.map((stage) => (
                                <div
                                    key={stage.id}
                                    className={`creator-stage-row${
                                        selectedStage?.id === stage.id ? " selected" : ""
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="creator-quest-select"
                                        onClick={() => setSelectedStageId(stage.id)}
                                    >
                                        {stage.title}
                                    </button>
                                    <button
                                        type="button"
                                        className="creator-entity-remove"
                                        onClick={() => removeStage(stage.id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="creator-card creator-stage-editor">
                        <div className="creator-section-heading">
                            <h2>Stage Editor</h2>
                            <span>{selectedStage?.id ?? "No stage"}</span>
                        </div>
                        {selectedStage ? (
                            <>
                                <div className="creator-form-grid">
                                    <TextField
                                        label="Stage title"
                                        value={selectedStage.title}
                                        onChange={(value) => setStageField("title", value)}
                                    />
                                    <TextField
                                        label="Stage id"
                                        value={selectedStage.id}
                                        onChange={(value) =>
                                            setStageField(
                                                "id",
                                                slugifyProjectId(value, selectedStage.id),
                                            )
                                        }
                                    />
                                </div>
                                <TextAreaField
                                    label="Journal text"
                                    value={selectedStage.journalText}
                                    onChange={(value) => setStageField("journalText", value)}
                                    rows={4}
                                />
                                <TextAreaField
                                    label="Objectives"
                                    value={formatMultilineList(selectedStage.objectives)}
                                    onChange={(value) =>
                                        setStageField("objectives", parseMultilineList(value))
                                    }
                                    rows={4}
                                    placeholder="One objective per line"
                                />

                                <div className="creator-list-editor">
                                    <div className="creator-subheading-row">
                                        <h3>Triggers</h3>
                                        <button
                                            type="button"
                                            className="creator-inline-button"
                                            onClick={() =>
                                                setStageCollection("triggers", [
                                                    ...selectedStage.triggers,
                                                    createTrigger(
                                                        selectedStage.triggers.length + 1,
                                                    ),
                                                ])
                                            }
                                        >
                                            Add Trigger
                                        </button>
                                    </div>
                                    {selectedStage.triggers.map((trigger) => (
                                        <div key={trigger.id} className="creator-list-row">
                                            <select
                                                value={trigger.kind}
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "triggers",
                                                        selectedStage.triggers.map((entry) =>
                                                            entry.id === trigger.id
                                                                ? {
                                                                      ...entry,
                                                                      kind: event.target
                                                                          .value as QuestTriggerKind,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            >
                                                {QUEST_TRIGGER_OPTIONS.map((entry) => (
                                                    <option key={entry} value={entry}>
                                                        {entry}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={trigger.target}
                                                placeholder="Target"
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "triggers",
                                                        selectedStage.triggers.map((entry) =>
                                                            entry.id === trigger.id
                                                                ? {
                                                                      ...entry,
                                                                      target: event.target.value,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            />
                                            <input
                                                type="text"
                                                value={trigger.value}
                                                placeholder="Value / option"
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "triggers",
                                                        selectedStage.triggers.map((entry) =>
                                                            entry.id === trigger.id
                                                                ? {
                                                                      ...entry,
                                                                      value: event.target.value,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            />
                                            <button
                                                type="button"
                                                className="creator-entity-remove"
                                                onClick={() =>
                                                    setStageCollection(
                                                        "triggers",
                                                        selectedStage.triggers.filter(
                                                            (entry) => entry.id !== trigger.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="creator-list-editor">
                                    <div className="creator-subheading-row">
                                        <h3>Actions</h3>
                                        <button
                                            type="button"
                                            className="creator-inline-button"
                                            onClick={() =>
                                                setStageCollection("actions", [
                                                    ...selectedStage.actions,
                                                    createAction(selectedStage.actions.length + 1),
                                                ])
                                            }
                                        >
                                            Add Action
                                        </button>
                                    </div>
                                    {selectedStage.actions.map((action) => (
                                        <div key={action.id} className="creator-list-row">
                                            <select
                                                value={action.kind}
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "actions",
                                                        selectedStage.actions.map((entry) =>
                                                            entry.id === action.id
                                                                ? {
                                                                      ...entry,
                                                                      kind: event.target
                                                                          .value as QuestActionKind,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            >
                                                {QUEST_ACTION_OPTIONS.map((entry) => (
                                                    <option key={entry} value={entry}>
                                                        {entry}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={action.target}
                                                placeholder="Target"
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "actions",
                                                        selectedStage.actions.map((entry) =>
                                                            entry.id === action.id
                                                                ? {
                                                                      ...entry,
                                                                      target: event.target.value,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            />
                                            <input
                                                type="text"
                                                value={action.value}
                                                placeholder="Value / payload"
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "actions",
                                                        selectedStage.actions.map((entry) =>
                                                            entry.id === action.id
                                                                ? {
                                                                      ...entry,
                                                                      value: event.target.value,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            />
                                            <button
                                                type="button"
                                                className="creator-entity-remove"
                                                onClick={() =>
                                                    setStageCollection(
                                                        "actions",
                                                        selectedStage.actions.filter(
                                                            (entry) => entry.id !== action.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="creator-list-editor">
                                    <div className="creator-subheading-row">
                                        <h3>Dialogue</h3>
                                        <button
                                            type="button"
                                            className="creator-inline-button"
                                            onClick={() =>
                                                setStageCollection("dialogue", [
                                                    ...selectedStage.dialogue,
                                                    createDialogueLine(
                                                        selectedStage.dialogue.length + 1,
                                                    ),
                                                ])
                                            }
                                        >
                                            Add Line
                                        </button>
                                    </div>
                                    {selectedStage.dialogue.map((line) => (
                                        <div
                                            key={line.id}
                                            className="creator-list-row creator-dialogue-row"
                                        >
                                            <input
                                                type="text"
                                                value={line.speaker}
                                                placeholder="Speaker"
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "dialogue",
                                                        selectedStage.dialogue.map((entry) =>
                                                            entry.id === line.id
                                                                ? {
                                                                      ...entry,
                                                                      speaker: event.target.value,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            />
                                            <textarea
                                                rows={2}
                                                value={line.text}
                                                placeholder="Dialogue line"
                                                onChange={(event) =>
                                                    setStageCollection(
                                                        "dialogue",
                                                        selectedStage.dialogue.map((entry) =>
                                                            entry.id === line.id
                                                                ? {
                                                                      ...entry,
                                                                      text: event.target.value,
                                                                  }
                                                                : entry,
                                                        ),
                                                    )
                                                }
                                            />
                                            <button
                                                type="button"
                                                className="creator-entity-remove"
                                                onClick={() =>
                                                    setStageCollection(
                                                        "dialogue",
                                                        selectedStage.dialogue.filter(
                                                            (entry) => entry.id !== line.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="creator-empty-state">Select a quest stage to edit.</div>
                        )}
                    </section>
                </div>
            ) : null}

            {workspace === "json" ? (
                <section className="creator-card">
                    <div className="creator-section-heading">
                        <h2>Project JSON</h2>
                        <span>{project.world.id}</span>
                    </div>
                    <pre className="creator-code-panel creator-code-large">{serializedProject}</pre>
                </section>
            ) : null}
        </div>
    );
}

export default CreatorStudioApp;
