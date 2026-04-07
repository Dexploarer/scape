type LocTransformStateReader = {
    varps: {
        getVarbitValue(varbitId: number): number;
        getVarpValue(varpId: number): number;
    };
};

type TransformableLocDefinition = {
    id?: number;
    transforms?: number[];
    transformVarbit?: number;
    transformVarp?: number;
};

type LocTypeLoaderLike = {
    load?: (id: number) => unknown;
};

export function resolveLocTransformId(
    player: LocTransformStateReader,
    loc: TransformableLocDefinition | undefined,
): number | undefined {
    if (!loc) {
        return undefined;
    }

    const transforms = loc.transforms;
    if (!transforms || transforms.length === 0) {
        const baseId = loc.id;
        return baseId && baseId > 0 ? baseId : undefined;
    }

    const transformVarbit = loc.transformVarbit;
    const transformVarp = loc.transformVarp;

    let transformIndex = -1;
    if (transformVarbit !== undefined && transformVarbit >= 0) {
        transformIndex = player.varps.getVarbitValue(transformVarbit);
    } else if (transformVarp !== undefined && transformVarp >= 0) {
        transformIndex = player.varps.getVarpValue(transformVarp);
    }

    let transformId = transforms[transforms.length - 1];
    if (transformIndex >= 0 && transformIndex < transforms.length - 1 && transforms[transformIndex] !== -1) {
        transformId = transforms[transformIndex];
    }

    const resolvedId = transformId;
    return resolvedId && resolvedId > 0 ? resolvedId : undefined;
}

export function locCanResolveToId(
    loc: TransformableLocDefinition | undefined,
    targetId: number,
): boolean {
    if (!(targetId > 0) || !loc) {
        return false;
    }

    const baseId = loc.id;
    if (baseId === targetId) {
        return true;
    }

    const transforms = loc.transforms;
    if (!transforms || transforms.length === 0) {
        return false;
    }

    for (const candidate of transforms) {
        if (candidate === targetId) {
            return true;
        }
    }

    return false;
}

export function loadVisibleLocTypeForPlayer(
    loader: LocTypeLoaderLike | undefined,
    player: LocTransformStateReader,
    locId: number,
): { id: number; type: unknown } | undefined {
    if (!(locId > 0) || !loader?.load) {
        return undefined;
    }

    const baseType = loader.load(locId);
    if (!baseType) {
        return undefined;
    }

    const visibleLocId =
        resolveLocTransformId(player, baseType as TransformableLocDefinition) ?? locId;
    if (visibleLocId === locId) {
        return { id: locId, type: baseType };
    }

    const visibleType = loader.load(visibleLocId);
    if (!visibleType) {
        return undefined;
    }

    return { id: visibleLocId, type: visibleType };
}
