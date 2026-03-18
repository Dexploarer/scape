import { loadVisibleLocTypeForPlayer } from "../../world/LocTransforms";

type ExamineVarReader = {
    getVarbitValue(varbitId: number): number;
    getVarpValue(varpId: number): number;
};

type LocTypeLoaderLike = {
    load?: (id: number) => unknown;
};

type NpcTypeLoaderLike = {
    load?: (id: number) => { desc?: string } | undefined;
};

type ObjTypeLoaderLike = {
    load?: (id: number) => { examine?: string } | undefined;
};

function normalizeExamineText(text: string | undefined): string | undefined {
    const trimmed = typeof text === "string" ? text.trim() : "";
    return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveLocExamineText(
    loader: LocTypeLoaderLike | undefined,
    player: ExamineVarReader,
    locId: number,
): string | undefined {
    if (!(locId > 0)) {
        return undefined;
    }

    const visible = loadVisibleLocTypeForPlayer(loader, player, locId);
    const type = (visible?.type ?? loader?.load?.(locId)) as { desc?: string } | undefined;
    return normalizeExamineText(type?.desc);
}

export function resolveNpcExamineText(
    loader: NpcTypeLoaderLike | undefined,
    npcTypeId: number,
): string | undefined {
    if (!(npcTypeId > 0)) {
        return undefined;
    }

    return normalizeExamineText(loader?.load?.(npcTypeId)?.desc);
}

export function resolveObjExamineText(
    loader: ObjTypeLoaderLike | undefined,
    itemId: number,
): string | undefined {
    if (!(itemId > 0)) {
        return undefined;
    }

    return normalizeExamineText(loader?.load?.(itemId)?.examine);
}
