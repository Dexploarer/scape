/**
 * MusicRegionService - Maps regions to music tracks.
 * Data sourced from OSRS Wiki: https://oldschool.runescape.wiki/w/Map:Music_tracks
 */
import * as fs from "fs";
import * as path from "path";

interface MusicData {
    regions: Record<number, number[]>;
    trackNames: Record<number, string>;
}

const DATA: MusicData = loadMusicData();

function loadMusicData(): MusicData {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "music-data.json"), "utf-8"));
    } catch {
        console.warn("[MusicRegionService] Could not load music-data.json");
        return { regions: {}, trackNames: {} };
    }
}

export interface MusicTrackInfo {
    trackId: number;
    trackName: string;
}

export class MusicRegionService {
    constructor() {
        const regionCount = Object.keys(DATA.regions).length;
        const trackCount = Object.keys(DATA.trackNames).length;
        console.log(
            `[MusicRegionService] Loaded ${regionCount} regions, ${trackCount} track names`,
        );
    }

    /** Get region ID from tile coordinates: ((x >> 6) << 8) | (y >> 6) */
    static getRegionId(tileX: number, tileY: number): number {
        return ((tileX >> 6) << 8) | (tileY >> 6);
    }

    /** Get track name for a track ID */
    getTrackName(trackId: number): string {
        return DATA.trackNames[trackId] || `Track ${trackId}`;
    }

    /** Get music for tile position */
    getMusicForTile(tileX: number, tileY: number): MusicTrackInfo | undefined {
        return this.getMusicForRegion(MusicRegionService.getRegionId(tileX, tileY));
    }

    /** Get first music track for region */
    getMusicForRegion(regionId: number): MusicTrackInfo | undefined {
        const trackIds = DATA.regions[regionId];
        if (!trackIds?.length) return undefined;
        return { trackId: trackIds[0], trackName: this.getTrackName(trackIds[0]) };
    }

    /** Get all music tracks for region (some regions shuffle multiple tracks) */
    getAllMusicForRegion(regionId: number): MusicTrackInfo[] {
        const trackIds = DATA.regions[regionId];
        if (!trackIds?.length) return [];
        return trackIds.map((id) => ({ trackId: id, trackName: this.getTrackName(id) }));
    }

    /** Get random track for region */
    getRandomMusicForRegion(regionId: number): MusicTrackInfo | undefined {
        const trackIds = DATA.regions[regionId];
        if (!trackIds?.length) return undefined;
        const id = trackIds[Math.floor(Math.random() * trackIds.length)];
        return { trackId: id, trackName: this.getTrackName(id) };
    }

    /** Check if region has music */
    hasMusic(regionId: number): boolean {
        return !!DATA.regions[regionId]?.length;
    }
}
