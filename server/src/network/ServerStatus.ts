export interface ServerStatusPayload {
    serverName: string;
    playerCount: number;
    maxPlayers: number;
    runtimeMode: "development" | "production";
}

export function buildServerStatus(params: ServerStatusPayload): ServerStatusPayload {
    return {
        serverName: params.serverName,
        playerCount: Math.max(0, params.playerCount | 0),
        maxPlayers: Math.max(0, params.maxPlayers | 0),
        runtimeMode: params.runtimeMode,
    };
}
