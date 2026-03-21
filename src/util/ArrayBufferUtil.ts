export function copyArrayBufferLike(
    source: ArrayBufferLike,
    byteOffset: number = 0,
    byteLength: number = source.byteLength - byteOffset,
): ArrayBuffer {
    const copy = new Uint8Array(byteLength);
    copy.set(new Uint8Array(source, byteOffset, byteLength));
    return copy.buffer;
}

export function copyArrayBufferView(view: ArrayBufferView): ArrayBuffer {
    return copyArrayBufferLike(view.buffer, view.byteOffset, view.byteLength);
}
