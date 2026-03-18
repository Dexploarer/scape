import { vec3 } from "gl-matrix";

export class Ray {
    readonly origin: vec3;
    readonly direction: vec3;

    constructor(origin: vec3, direction: vec3) {
        this.origin = vec3.clone(origin);
        this.direction = vec3.clone(direction);
        const len = vec3.length(this.direction);
        if (len > 0 && Math.abs(len - 1) > 1e-6) {
            vec3.scale(this.direction, this.direction, 1 / len);
        }
    }

    at(t: number, out?: vec3): vec3 {
        const target = out ? out : vec3.create();
        target[0] = this.origin[0] + this.direction[0] * t;
        target[1] = this.origin[1] + this.direction[1] * t;
        target[2] = this.origin[2] + this.direction[2] * t;
        return target;
    }
}

export type RayBoxHit = {
    tMin: number;
    tMax: number;
};

export function rayIntersectsBox(
    ray: Ray,
    min: readonly [number, number, number],
    max: readonly [number, number, number],
): RayBoxHit | null {
    let tMin = -Infinity;
    let tMax = Infinity;

    for (let axis = 0; axis < 3; axis++) {
        const origin = ray.origin[axis];
        const dir = ray.direction[axis];
        const invDir = dir !== 0 ? 1 / dir : Number.POSITIVE_INFINITY;
        let t0 = (min[axis] - origin) * invDir;
        let t1 = (max[axis] - origin) * invDir;

        if (t0 > t1) {
            const tmp = t0;
            t0 = t1;
            t1 = tmp;
        }

        if (t0 > tMin) tMin = t0;
        if (t1 < tMax) tMax = t1;
        if (tMax < tMin) {
            return null;
        }
    }

    if (tMax < 0) {
        return null;
    }

    return { tMin, tMax };
}

export function rayIntersectsTriangle(
    ray: Ray,
    v0: readonly [number, number, number],
    v1: readonly [number, number, number],
    v2: readonly [number, number, number],
): number | null {
    const EPS = 1e-6;

    const edge1x = v1[0] - v0[0];
    const edge1y = v1[1] - v0[1];
    const edge1z = v1[2] - v0[2];

    const edge2x = v2[0] - v0[0];
    const edge2y = v2[1] - v0[1];
    const edge2z = v2[2] - v0[2];

    const dirx = ray.direction[0];
    const diry = ray.direction[1];
    const dirz = ray.direction[2];

    const px = diry * edge2z - dirz * edge2y;
    const py = dirz * edge2x - dirx * edge2z;
    const pz = dirx * edge2y - diry * edge2x;

    const det = edge1x * px + edge1y * py + edge1z * pz;
    if (det > -EPS && det < EPS) {
        return null;
    }
    const invDet = 1 / det;

    const tx = ray.origin[0] - v0[0];
    const ty = ray.origin[1] - v0[1];
    const tz = ray.origin[2] - v0[2];

    const u = (tx * px + ty * py + tz * pz) * invDet;
    if (u < 0 || u > 1) {
        return null;
    }

    const qx = ty * edge1z - tz * edge1y;
    const qy = tz * edge1x - tx * edge1z;
    const qz = tx * edge1y - ty * edge1x;

    const v = (dirx * qx + diry * qy + dirz * qz) * invDet;
    if (v < 0 || u + v > 1) {
        return null;
    }

    const t = (edge2x * qx + edge2y * qy + edge2z * qz) * invDet;
    if (t <= EPS) {
        return null;
    }

    return t;
}

export function rayIntersectsTileColumn(
    ray: Ray,
    tileX: number,
    tileY: number,
    minY: number,
    maxY: number,
): RayBoxHit | null {
    const min: [number, number, number] = [tileX, minY, tileY];
    const max: [number, number, number] = [tileX + 1, maxY, tileY + 1];
    return rayIntersectsBox(ray, min, max);
}
