function describeSerializationError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch (error) {
        return JSON.stringify({
            serializationError: describeSerializationError(error),
        });
    }
}

export function safeJsonStringifyOptional(value: unknown): string | undefined {
    return value === undefined ? undefined : safeJsonStringify(value);
}
