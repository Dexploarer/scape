export function getRequestPathname(url: string | undefined): string {
    return (url ?? "/").split("?")[0] ?? "/";
}
