const EXTENSION_PROTOCOL_PATTERN = /(chrome-extension|moz-extension|safari-web-extension):\/\//i;
let extensionRuntimeErrorFilterInstalled = false;

function isExtensionUrl(value: unknown): boolean {
    return typeof value === "string" && EXTENSION_PROTOCOL_PATTERN.test(value);
}

function collectErrorStrings(value: unknown, out: string[], seen: Set<object>): void {
    if (typeof value === "string") {
        out.push(value);
        return;
    }
    if (!value || typeof value !== "object") {
        return;
    }
    if (seen.has(value)) {
        return;
    }
    seen.add(value);

    const record = value as Record<string, unknown>;
    for (const key of ["filename", "fileName", "source", "stack", "message", "reason"]) {
        const next = record[key];
        if (typeof next === "string") {
            out.push(next);
        } else if (next && typeof next === "object") {
            collectErrorStrings(next, out, seen);
        }
    }

    for (const next of Object.values(record)) {
        if (typeof next === "string") {
            out.push(next);
        } else if (next && typeof next === "object") {
            collectErrorStrings(next, out, seen);
        }
    }
}

export function isExtensionRuntimeErrorCandidate(value: unknown): boolean {
    const strings: string[] = [];
    collectErrorStrings(value, strings, new Set());
    return strings.some(isExtensionUrl);
}

export function shouldSuppressWindowErrorEvent(event: Pick<ErrorEvent, "filename" | "message" | "error">): boolean {
    return isExtensionRuntimeErrorCandidate({
        filename: event.filename,
        message: event.message,
        error: event.error,
    });
}

export function shouldSuppressUnhandledRejectionEvent(
    event: Pick<PromiseRejectionEvent, "reason">,
): boolean {
    return isExtensionRuntimeErrorCandidate({
        reason: event.reason,
    });
}

export function installExtensionRuntimeErrorFilter(): void {
    if (typeof window === "undefined" || extensionRuntimeErrorFilterInstalled) {
        return;
    }
    extensionRuntimeErrorFilterInstalled = true;

    window.addEventListener(
        "error",
        (event) => {
            if (!shouldSuppressWindowErrorEvent(event)) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation?.();
            console.info("[runtime] suppressed browser extension error", event.filename);
        },
        true,
    );

    window.addEventListener(
        "unhandledrejection",
        (event) => {
            if (!shouldSuppressUnhandledRejectionEvent(event)) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation?.();
            console.info("[runtime] suppressed browser extension rejection");
        },
        true,
    );
}
