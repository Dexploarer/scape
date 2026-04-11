const WORLD_SELECTION_BYPASS_PARAMS = ["username", "password", "autoplay"] as const;

export function shouldBypassWorldSelection(search: string): boolean {
    const params = new URLSearchParams(search);
    return WORLD_SELECTION_BYPASS_PARAMS.some((param) => params.has(param));
}
