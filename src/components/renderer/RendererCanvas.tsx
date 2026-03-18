import { useEffect, useRef } from "react";

import { Renderer } from "./Renderer";

export interface RendererCanvasProps {
    renderer: Renderer;
}

export function RendererCanvas({ renderer }: RendererCanvasProps): JSX.Element {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!divRef.current) {
            return;
        }
        divRef.current.appendChild(renderer.canvas);
        // Attach a ResizeObserver to the canvas to react instantly to host size changes
        renderer.attachResizeObserver();

        renderer.init().then(() => {
            renderer.start();
            renderer.forceResize();
        });

        return () => {
            renderer.stop();
            divRef.current?.removeChild(renderer.canvas);
        };
    }, [renderer]);

    return <div ref={divRef} style={{ width: "100%", height: "100%" }} tabIndex={0} />;
}
