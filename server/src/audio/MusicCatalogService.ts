import type { DbRepository } from "../../../src/rs/config/db/DbRepository";
import type { DbRow } from "../../../src/rs/config/db/DbRow";

const MUSIC_DB_TABLE_ID = 44;
const MUSIC_SORTNAME_COLUMN_ID = 0;
const MUSIC_DISPLAYNAME_COLUMN_ID = 1;
const MUSIC_UNLOCK_HINT_COLUMN_ID = 2;
const MUSIC_MIDI_COLUMN_ID = 4;
const MUSIC_VARIABLE_COLUMN_ID = 5;
const MUSIC_AUTOMATIC_UNLOCK_COLUMN_ID = 6;
const MUSIC_HIDDEN_COLUMN_ID = 9;

export interface MusicCatalogEntry {
    rowId: number;
    trackId: number;
    trackName: string;
    sortName: string;
    unlockHint: string;
    unlockVarpIndex: number;
    unlockBitIndex: number;
    automaticUnlock: boolean;
    hidden: boolean;
}

function normalizeTrackName(trackName: string): string {
    return trackName.trim().toLowerCase();
}

export class MusicCatalogService {
    private readonly tracks: MusicCatalogEntry[];
    private readonly tracksInBaseOrder: MusicCatalogEntry[];
    private readonly tracksByRowId = new Map<number, MusicCatalogEntry>();
    private readonly tracksByMidiId = new Map<number, MusicCatalogEntry>();
    private readonly tracksByName = new Map<string, MusicCatalogEntry>();

    constructor(private readonly dbRepository: DbRepository) {
        const tracks = this.buildTracks();
        this.tracks = tracks;
        this.tracksInBaseOrder = tracks.filter((track) => !track.hidden);

        for (const track of tracks) {
            this.tracksByRowId.set(track.rowId, track);
            if (!this.tracksByMidiId.has(track.trackId)) {
                this.tracksByMidiId.set(track.trackId, track);
            }
            const normalizedName = normalizeTrackName(track.trackName);
            if (normalizedName.length > 0 && !this.tracksByName.has(normalizedName)) {
                this.tracksByName.set(normalizedName, track);
            }
        }
    }

    getTracks(): readonly MusicCatalogEntry[] {
        return this.tracks;
    }

    getBaseTrackCount(): number {
        return this.tracksInBaseOrder.length;
    }

    getBaseListTrackBySlot(slot: number): MusicCatalogEntry | undefined {
        if (!Number.isFinite(slot)) {
            return undefined;
        }
        const normalizedSlot = slot | 0;
        if (normalizedSlot < 0 || normalizedSlot >= this.tracksInBaseOrder.length) {
            return undefined;
        }
        return this.tracksInBaseOrder[normalizedSlot];
    }

    getTrackByMidiId(trackId: number): MusicCatalogEntry | undefined {
        return this.tracksByMidiId.get(trackId | 0);
    }

    getTrackByRowId(rowId: number): MusicCatalogEntry | undefined {
        return this.tracksByRowId.get(rowId | 0);
    }

    getTrackByName(trackName: string): MusicCatalogEntry | undefined {
        if (!trackName) {
            return undefined;
        }
        return this.tracksByName.get(normalizeTrackName(trackName));
    }

    private buildTracks(): MusicCatalogEntry[] {
        const tracks: MusicCatalogEntry[] = [];
        for (const row of this.dbRepository.getRows(MUSIC_DB_TABLE_ID)) {
            const entry = this.buildTrack(row);
            if (entry) {
                tracks.push(entry);
            }
        }
        return tracks;
    }

    private buildTrack(row: DbRow): MusicCatalogEntry | undefined {
        const trackId = this.getNumberValue(row, MUSIC_MIDI_COLUMN_ID, -1);
        if (trackId < 0) {
            return undefined;
        }

        const trackName = this.getStringValue(row, MUSIC_DISPLAYNAME_COLUMN_ID);
        const sortName = this.getStringValue(row, MUSIC_SORTNAME_COLUMN_ID) || trackName;
        const unlockHint = this.getStringValue(row, MUSIC_UNLOCK_HINT_COLUMN_ID);
        const variableValues = this.getValues(row, MUSIC_VARIABLE_COLUMN_ID);

        return {
            rowId: row.id,
            trackId,
            trackName,
            sortName,
            unlockHint,
            unlockVarpIndex: this.normalizeNumber(variableValues[0], -1),
            unlockBitIndex: this.normalizeNumber(variableValues[1], -1),
            automaticUnlock: this.getBooleanValue(row, MUSIC_AUTOMATIC_UNLOCK_COLUMN_ID, false),
            hidden: this.getBooleanValue(row, MUSIC_HIDDEN_COLUMN_ID, false),
        };
    }

    private getValues(row: DbRow, columnId: number): any[] {
        const explicit = row.getColumn(columnId)?.values;
        if (explicit && explicit.length > 0) {
            return explicit;
        }

        const defaultValues = this.dbRepository
            .getTables()
            .get(MUSIC_DB_TABLE_ID)
            ?.getColumn(columnId)?.defaultValues;
        return defaultValues ? [...defaultValues] : [];
    }

    private getStringValue(row: DbRow, columnId: number): string {
        const value = this.getValues(row, columnId)[0];
        return typeof value === "string" ? value : "";
    }

    private getNumberValue(row: DbRow, columnId: number, fallback: number): number {
        return this.normalizeNumber(this.getValues(row, columnId)[0], fallback);
    }

    private getBooleanValue(row: DbRow, columnId: number, fallback: boolean): boolean {
        const value = this.getValues(row, columnId)[0];
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "number") {
            return value !== 0;
        }
        return fallback;
    }

    private normalizeNumber(value: unknown, fallback: number): number {
        return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    }
}
