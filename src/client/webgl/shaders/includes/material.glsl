struct Material {
    int animU;
    int animV;
    float alphaCutOff;
    int frameCount;
    int animSpeed;
};

Material getMaterial(uint textureId) {
    ivec4 data = texelFetch(u_textureMaterials, ivec2(textureId, 0), 0);
    ivec4 data1 = texelFetch(u_textureMaterials, ivec2(textureId, 1), 0);

    Material material;
    material.animU = data.r;
    material.animV = data.g;
    material.alphaCutOff = float(data.b & 0xFF) / 255.0;
    material.frameCount = data.a & 0xFF;
    material.animSpeed = data1.r & 0xFF;
    if (material.frameCount == 0) {
        material.frameCount = 1;
    }

    return material;
}
