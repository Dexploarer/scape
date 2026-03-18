export interface TextureMaterial {
    animU: number;
    animV: number;
    alphaCutOff: number;
    /**
     * Number of animation frames packed for this texture (minimum 1).
     * Textures that rely solely on UV scrolling should set this to 1.
     */
    frameCount: number;
    /**
     * Texture animation speed byte from the cache definition.
     * Used for frame-cycling when frameCount > 1 and to scale UV scroll rate.
     */
    animSpeed: number;
}
