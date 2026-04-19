export function createMapImageCacheRequest(path: string, cacheName: string): Request {
    const locationOrigin =
        typeof globalThis.location !== "undefined" ? globalThis.location.origin : undefined;
    const origin =
        locationOrigin && locationOrigin.length > 0 ? locationOrigin : "https://scape.local";
    const url = new URL(path, origin).toString();

    return new Request(url, {
        headers: {
            "RS-Cache-Name": cacheName,
        },
    });
}

export async function createCacheableImageResponse(
    response: Response,
): Promise<Response | undefined> {
    const contentType = response.headers.get("Content-Type")?.toLowerCase();
    if (!response.ok || !contentType || !contentType.startsWith("image/")) {
        return undefined;
    }

    const blob = await response.blob();
    if (!blob.type || !blob.type.toLowerCase().startsWith("image/")) {
        return undefined;
    }

    return new Response(blob, {
        status: 200,
        headers: {
            "Content-Type": blob.type,
            "Content-Length": blob.size.toString(),
        },
    });
}
