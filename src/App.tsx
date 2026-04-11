import { useState } from "react";

import OsrsClientApp from "./client/OsrsClientApp";
import { WorldSelectionPage } from "./client/WorldSelectionPage";
import { type ServerDirectoryEntry } from "./client/login/serverDirectory";
import { shouldBypassWorldSelection } from "./client/worldSelectionGate";
import { setServerUrl } from "./network/ServerConnection";

function toWebSocketUrl(entry: Pick<ServerDirectoryEntry, "address" | "secure">): string {
    return `${entry.secure ? "wss" : "ws"}://${entry.address}`;
}

export default function App(): JSX.Element {
    const [launchClient, setLaunchClient] = useState<boolean>(() =>
        shouldBypassWorldSelection(window.location.search),
    );

    if (launchClient) {
        return <OsrsClientApp />;
    }

    return (
        <WorldSelectionPage
            onSelect={(entry) => {
                setServerUrl(toWebSocketUrl(entry));
                setLaunchClient(true);
            }}
        />
    );
}
