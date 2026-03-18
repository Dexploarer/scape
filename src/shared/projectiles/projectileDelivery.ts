import type { ProjectileLaunch } from "./ProjectileLaunch";

export function adjustProjectileLaunchForElapsedCycles(
    launch: ProjectileLaunch,
    elapsedCycles: number,
): ProjectileLaunch {
    const elapsed = Math.max(0, Math.floor(elapsedCycles));
    if (elapsed <= 0) {
        return launch;
    }

    const startCycleOffset = Math.max(0, launch.startCycleOffset - elapsed);
    const endCycleOffset = Math.max(startCycleOffset + 1, launch.endCycleOffset - elapsed);
    if (startCycleOffset === launch.startCycleOffset && endCycleOffset === launch.endCycleOffset) {
        return launch;
    }

    return {
        ...launch,
        startCycleOffset,
        endCycleOffset,
    };
}

export function adjustProjectileLaunchesForElapsedCycles(
    launches: ProjectileLaunch[],
    elapsedCycles: number,
): ProjectileLaunch[] {
    const elapsed = Math.max(0, Math.floor(elapsedCycles));
    if (elapsed <= 0) {
        return launches;
    }

    return launches.map((launch) => adjustProjectileLaunchForElapsedCycles(launch, elapsed));
}
