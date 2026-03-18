import React, { useEffect, useState } from "react";

import { getCurrentTick, subscribeTick } from "../../network/ServerConnection";

export function TickCounter(): JSX.Element {
    const [tick, setTick] = useState<number>(getCurrentTick());

    useEffect(() => {
        const unsub = subscribeTick((t) => setTick(t));
        return () => unsub();
    }, []);

    return (
        <div className="hud right-bottom">
            <div
                className="content-text"
                style={{
                    background: "rgba(0,0,0,0.45)",
                    padding: "6px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#fff",
                    minWidth: 80,
                    textAlign: "right",
                    pointerEvents: "none",
                }}
            >
                <strong>Tick:</strong> {tick}
            </div>
        </div>
    );
}
