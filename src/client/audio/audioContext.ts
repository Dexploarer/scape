type AudioContextConstructor = {
    new (contextOptions?: AudioContextOptions): AudioContext;
};

const AUDIO_CONTEXT_RESUME_EVENTS: (keyof DocumentEventMap)[] = ["click", "keydown", "touchstart"];

export function getAudioContextConstructor(): AudioContextConstructor | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    return window.AudioContext ?? window.webkitAudioContext;
}

export function addAudioContextResumeListeners(
    ctx: AudioContext,
    onRunning?: () => void,
): () => void {
    if (typeof document === "undefined") {
        return () => {};
    }

    let active = true;

    function cleanup(): void {
        if (!active) {
            return;
        }
        active = false;
        for (const eventType of AUDIO_CONTEXT_RESUME_EVENTS) {
            document.removeEventListener(eventType, listener);
        }
    }

    function listener(): void {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }
        if (ctx.state === "running") {
            cleanup();
            onRunning?.();
        }
    }

    for (const eventType of AUDIO_CONTEXT_RESUME_EVENTS) {
        document.addEventListener(eventType, listener);
    }

    return cleanup;
}
