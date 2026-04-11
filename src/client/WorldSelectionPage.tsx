import { useEffect, useState } from "react";

import {
    createSelectedServerStorageValue,
    fetchServerDirectory,
    probeServerDirectory,
    type ServerDirectoryEntry,
} from "./login/serverDirectory";
import "./WorldSelectionPage.css";

const LAST_SERVER_STORAGE_KEY = "osrs:lastServer";
const PUBLIC_URL = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");

function formatPopulation(entry: ServerDirectoryEntry): string {
    if (entry.playerCount === null) {
        return "Offline";
    }
    if (entry.playerCount === -1) {
        return "Online";
    }
    return `${entry.playerCount}/${entry.maxPlayers}`;
}

function getRegionLabel(location: number): string {
    switch (location | 0) {
        case 1:
            return "United Kingdom";
        case 3:
            return "Australia";
        case 7:
            return "Germany";
        default:
            return "United States";
    }
}

function readLastSelectedAddress(): string | undefined {
    try {
        const raw = localStorage.getItem(LAST_SERVER_STORAGE_KEY);
        if (!raw) {
            return undefined;
        }
        const parsed = JSON.parse(raw) as { address?: unknown };
        return typeof parsed.address === "string" && parsed.address.length > 0 ? parsed.address : undefined;
    } catch {
        return undefined;
    }
}

type WorldSelectionPageProps = {
    onSelect(entry: ServerDirectoryEntry): void;
};

export function WorldSelectionPage({ onSelect }: WorldSelectionPageProps): JSX.Element {
    const [entries, setEntries] = useState<ServerDirectoryEntry[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [lastSelectedAddress] = useState<string | undefined>(() => readLastSelectedAddress());

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const directory = await fetchServerDirectory();
            if (cancelled) return;
            setEntries(directory);
            setStatus("ready");

            const probed = await probeServerDirectory(directory);
            if (cancelled) return;
            setEntries(probed);
        };

        load().catch(() => {
            if (cancelled) return;
            setStatus("error");
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="world-selection">
            <div
                className="world-selection__backdrop"
                style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 8, 8, 0.35), rgba(8, 8, 8, 0.78)), url(${PUBLIC_URL}/images/loading-bg.jpg)`,
                }}
            />
            <main className="world-selection__panel">
                <img
                    className="world-selection__logo"
                    src={`${PUBLIC_URL}/images/logo.png`}
                    alt="'scape"
                />
                <p className="world-selection__eyebrow">Hosted Worlds</p>
                <h1 className="world-selection__title">Choose a world</h1>
                <p className="world-selection__subtitle">
                    Select the shard you want to play on before the client boots.
                </p>

                {status === "loading" ? (
                    <p className="world-selection__status">Loading worlds…</p>
                ) : null}
                {status === "error" ? (
                    <p className="world-selection__status world-selection__status--error">
                        Failed to load the directory feed. Falling back to the build default.
                    </p>
                ) : null}

                <section className="world-selection__grid" aria-label="Available worlds">
                    {entries.map((entry) => {
                        const lastPlayed = entry.address === lastSelectedAddress;
                        return (
                            <button
                                key={`${entry.id}:${entry.address}`}
                                type="button"
                                className="world-selection__card"
                                onClick={() => {
                                    try {
                                        localStorage.setItem(
                                            LAST_SERVER_STORAGE_KEY,
                                            createSelectedServerStorageValue(entry),
                                        );
                                    } catch {}
                                    onSelect(entry);
                                }}
                            >
                                <div className="world-selection__cardTop">
                                    <span className="world-selection__worldId">World {entry.id}</span>
                                    {lastPlayed ? (
                                        <span className="world-selection__badge">Last played</span>
                                    ) : null}
                                </div>
                                <h2 className="world-selection__worldName">{entry.name}</h2>
                                <p className="world-selection__activity">
                                    {entry.activity === "-" ? "General" : entry.activity}
                                </p>
                                <p className="world-selection__meta">
                                    {getRegionLabel(entry.location)} • {entry.address}
                                </p>
                                {entry.description ? (
                                    <p className="world-selection__description">{entry.description}</p>
                                ) : null}
                                <div className="world-selection__cardFooter">
                                    <span
                                        className={
                                            entry.playerCount === null
                                                ? "world-selection__population world-selection__population--offline"
                                                : "world-selection__population"
                                        }
                                    >
                                        {formatPopulation(entry)}
                                    </span>
                                    <span className="world-selection__cta">Enter world</span>
                                </div>
                            </button>
                        );
                    })}
                </section>
            </main>
        </div>
    );
}
