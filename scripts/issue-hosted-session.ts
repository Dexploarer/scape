type HostedSessionKind = "human" | "agent";

export interface HostedSessionIssueCliOptions {
    issuerUrl: string;
    issuerSecret: string;
    kind: HostedSessionKind;
    principalId: string;
    displayName: string;
    worldCharacterId: string;
    agentId?: string;
    ttlMs?: number;
    webBaseUrl?: string;
    json: boolean;
}

export interface HostedSessionIssueResponse {
    sessionToken: string;
    claims: {
        version: 1;
        kind: HostedSessionKind;
        principalId: string;
        worldId: string;
        worldCharacterId: string;
        displayName: string;
        issuedAt: number;
        expiresAt: number;
        agentId?: string;
    };
}

function nonEmptyString(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function readFlagValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
    return args.includes(flag);
}

export function buildHostedWebLaunchUrl(
    baseUrl: string | undefined,
    sessionToken: string,
    worldCharacterId: string,
): string | undefined {
    const normalizedBaseUrl = nonEmptyString(baseUrl);
    if (!normalizedBaseUrl) return undefined;

    const url = new URL(normalizedBaseUrl);
    url.searchParams.set("sessionToken", sessionToken);
    url.searchParams.set("worldCharacterId", worldCharacterId);
    return url.toString();
}

export function parseIssueHostedSessionArgs(
    argv: string[],
    env: NodeJS.ProcessEnv = process.env,
): HostedSessionIssueCliOptions {
    const kindRaw = nonEmptyString(readFlagValue(argv, "--kind"));
    if (kindRaw !== "human" && kindRaw !== "agent") {
        throw new Error('--kind must be either "human" or "agent".');
    }

    const issuerUrl =
        nonEmptyString(readFlagValue(argv, "--issuer-url")) ??
        nonEmptyString(env.HOSTED_SESSION_ISSUER_URL) ??
        "http://127.0.0.1:43594/hosted-session/issue";
    const issuerSecret =
        nonEmptyString(readFlagValue(argv, "--issuer-secret")) ??
        nonEmptyString(env.HOSTED_SESSION_ISSUER_SECRET);
    if (!issuerSecret) {
        throw new Error("Missing issuer secret. Set HOSTED_SESSION_ISSUER_SECRET or pass --issuer-secret.");
    }

    const principalId = nonEmptyString(readFlagValue(argv, "--principal-id"));
    const displayName = nonEmptyString(readFlagValue(argv, "--display-name"));
    const worldCharacterId = nonEmptyString(readFlagValue(argv, "--world-character-id"));
    if (!principalId || !displayName || !worldCharacterId) {
        throw new Error(
            "--principal-id, --display-name, and --world-character-id are required.",
        );
    }

    const agentId = nonEmptyString(readFlagValue(argv, "--agent-id"));
    if (kindRaw === "agent" && !agentId) {
        throw new Error("--agent-id is required when --kind agent is used.");
    }

    const ttlRaw = nonEmptyString(readFlagValue(argv, "--ttl-ms"));
    let ttlMs: number | undefined;
    if (ttlRaw) {
        const parsed = Number.parseInt(ttlRaw, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error("--ttl-ms must be a positive integer.");
        }
        ttlMs = parsed;
    }

    const webBaseUrl =
        nonEmptyString(readFlagValue(argv, "--web-base-url")) ??
        nonEmptyString(env.WEB_CLIENT_BASE_URL);

    return {
        issuerUrl,
        issuerSecret,
        kind: kindRaw,
        principalId,
        displayName,
        worldCharacterId,
        agentId,
        ttlMs,
        webBaseUrl,
        json: hasFlag(argv, "--json"),
    };
}

export async function issueHostedSession(
    options: HostedSessionIssueCliOptions,
): Promise<HostedSessionIssueResponse> {
    const response = await fetch(options.issuerUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${options.issuerSecret}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            kind: options.kind,
            principalId: options.principalId,
            displayName: options.displayName,
            worldCharacterId: options.worldCharacterId,
            agentId: options.agentId,
            ttlMs: options.ttlMs,
        }),
    });

    const payload = (await response.json()) as
        | HostedSessionIssueResponse
        | { code?: string; error?: string };

    if (!response.ok) {
        throw new Error(
            `Issuer request failed (${response.status}): ${
                "error" in payload && typeof payload.error === "string"
                    ? payload.error
                    : "unknown error"
            }`,
        );
    }

    return payload as HostedSessionIssueResponse;
}

function printUsage(): void {
    console.log(`Usage:
  bun scripts/issue-hosted-session.ts \\
    --kind <human|agent> \\
    --principal-id <principal> \\
    --display-name <name> \\
    --world-character-id <world-character> \\
    [--agent-id <agent>] \\
    [--ttl-ms <milliseconds>] \\
    [--issuer-url <url>] \\
    [--issuer-secret <secret>] \\
    [--web-base-url <url>] \\
    [--json]

Environment fallbacks:
  HOSTED_SESSION_ISSUER_URL
  HOSTED_SESSION_ISSUER_SECRET
  WEB_CLIENT_BASE_URL
`);
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    if (hasFlag(argv, "--help")) {
        printUsage();
        return;
    }

    const options = parseIssueHostedSessionArgs(argv);
    const result = await issueHostedSession(options);
    const webLaunchUrl = buildHostedWebLaunchUrl(
        options.webBaseUrl,
        result.sessionToken,
        result.claims.worldCharacterId,
    );

    if (options.json) {
        console.log(
            JSON.stringify(
                {
                    ...result,
                    webLaunchUrl,
                    botSdkSpawn: {
                        sessionToken: result.sessionToken,
                        worldCharacterId: result.claims.worldCharacterId,
                        agentId: result.claims.agentId,
                    },
                },
                null,
                2,
            ),
        );
        return;
    }

    console.log(`sessionToken=${result.sessionToken}`);
    console.log(`worldId=${result.claims.worldId}`);
    console.log(`worldCharacterId=${result.claims.worldCharacterId}`);
    console.log(`kind=${result.claims.kind}`);
    console.log(`principalId=${result.claims.principalId}`);
    console.log(`displayName=${result.claims.displayName}`);
    if (result.claims.agentId) {
        console.log(`agentId=${result.claims.agentId}`);
    }
    console.log(`expiresAt=${result.claims.expiresAt}`);
    if (webLaunchUrl) {
        console.log(`webLaunchUrl=${webLaunchUrl}`);
    }
    console.log(
        `botSdkSpawn=${JSON.stringify(
            {
                sessionToken: result.sessionToken,
                worldCharacterId: result.claims.worldCharacterId,
                agentId: result.claims.agentId,
            },
            null,
            2,
        )}`,
    );
}

if (import.meta.main) {
    main().catch((error) => {
        console.error(
            error instanceof Error ? `[issue-hosted-session] ${error.message}` : error,
        );
        process.exit(1);
    });
}
