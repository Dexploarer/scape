export interface ServerConfig {
    host: string;
    port: number;
    tickMs: number;
}

const portEnv = process.env.PORT?.trim();
const tickMsEnv = process.env.TICK_MS?.trim();

export const config: ServerConfig = {
    // Bind all interfaces by default so LAN/mobile clients can reach the WS server.
    host: process.env.HOST || "0.0.0.0",
    port: portEnv ? parseInt(portEnv, 10) || 43594 : 43594, // classic RuneScape default port
    tickMs: tickMsEnv ? parseInt(tickMsEnv, 10) || 600 : 600, // 0.6s tick
};
