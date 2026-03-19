import { useEffect, useRef } from "react";

import { Renderer } from "../components/renderer/Renderer";

export interface CanvasProps {
    renderer: Renderer;
}

export function Canvas({ renderer }: CanvasProps): JSX.Element {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!divRef.current) {
            return;
        }
        divRef.current.appendChild(renderer.canvas);
        renderer.attachResizeObserver();
        requestAnimationFrame(() => renderer.forceResize());

        renderer.init().then(() => {
            renderer.start();
        });

        return () => {
            renderer.stop();
            divRef.current?.removeChild(renderer.canvas);
        };
    }, [renderer]);

    return (
        <div
            ref={divRef}
            style={{ position: "relative", width: "100%", height: "100%" }}
            tabIndex={0}
        />
    );
}
