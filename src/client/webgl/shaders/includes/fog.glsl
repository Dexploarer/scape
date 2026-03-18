// Linear fog ramp that starts at u_fogDepth (tiles) and reaches full fog at u_renderDistance.
// Matches the simple OSRS horizon ramp and avoids sudden "pop" when the horizon is reached.
float fogFactorOSRS(float dist) {
    float fogStart = min(u_fogDepth, u_renderDistance);
    float fogEnd = max(u_renderDistance, fogStart + 0.0001);
    return clamp((dist - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
}

float fogFactorLinear(float dist, float start, float end) {
    return 1.0 - clamp((dist - start) / (end - start), 0.0, 1.0);
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
