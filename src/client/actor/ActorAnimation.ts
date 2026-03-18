import { DrawRange } from "../webgl/DrawRange";

// A unified clip description for actors (NPCs or Players).
// Contains pre-baked draw ranges and minimal stepping metadata.
export type ActorAnimationClip = {
    frames: DrawRange[];
    framesAlpha?: DrawRange[];
    // Sequencer metadata
    isSkeletal: boolean;
    frameCount: number;
    frameLengths?: number[]; // per-frame lengths (non-skeletal)
    frameStep: number; // step used when looping wraps
    looping: boolean;
    maxLoops: number;
};

// Minimal controller that advances frames using OSRS-like rules.
// Mirrors Npc.updateMovementSeq stepping semantics to keep behavior consistent.
export class ActorAnimController {
    seqId: number;
    clip: ActorAnimationClip;

    frameIndex: number = 0;
    frameTick: number = 0;
    loopCount: number = 0;

    constructor(seqId: number, clip: ActorAnimationClip) {
        this.seqId = seqId | 0;
        this.clip = clip;
    }

    reset(): void {
        this.frameIndex = 0;
        this.frameTick = 0;
        this.loopCount = 0;
    }

    // Advance by the given number of client ticks.
    step(ticks: number = 1): void {
        if (!this.clip || this.clip.frameCount <= 0) return;
        for (let t = 0; t < (ticks | 0); t++) {
            if (this.clip.isSkeletal) {
                // Skeletal: increment frame index each tick; wrap with frameStep and looping rules.
                this.frameIndex++;
                const frameCount = this.clip.frameCount;
                if (this.frameIndex >= frameCount) {
                    if (this.clip.frameStep > 0) {
                        this.frameIndex -= this.clip.frameStep;
                        if (this.clip.looping) {
                            this.loopCount++;
                        }

                        // Check if animation should reset completely
                        const shouldReset =
                            this.frameIndex < 0 ||
                            this.frameIndex >= frameCount ||
                            (this.clip.looping && this.loopCount >= this.clip.maxLoops);

                        if (shouldReset) {
                            this.frameTick = 0;
                            this.frameIndex = 0;
                            this.loopCount = 0;
                        } else {
                            // Valid wrap - keep the wrapped frameIndex, just reset frameTick
                            this.frameTick = 0;
                            // frameIndex is already correctly set from the subtraction above
                        }
                    } else {
                        // No frameStep - reset to beginning
                        this.frameTick = 0;
                        this.frameIndex = 0;
                    }
                }
            } else {
                // Frame-based: advance tick, then increment frameIndex if exceeded frame length
                this.frameTick++;
                const frameCount = this.clip.frameCount;
                const lengths = this.clip.frameLengths;
                if (!lengths || frameCount <= 0) {
                    // Fallback safety: behave like skeletal one-tick-per-frame
                    this.frameIndex = (this.frameIndex + 1) % Math.max(frameCount, 1);
                    this.frameTick = 0;
                    continue;
                }
                // Validate array bounds - use clamped index to prevent out-of-bounds access
                const safeFrameIndex = Math.min(this.frameIndex, lengths.length - 1);
                // OSRS parity: 0 is a valid frame length (advances immediately when cycle > 0)
                const currLen = (lengths[safeFrameIndex] ?? 0) | 0;
                if (this.frameTick > currLen) {
                    this.frameTick = 1;
                    this.frameIndex++;
                }
                if (this.frameIndex >= frameCount) {
                    if (this.clip.frameStep > 0) {
                        this.frameIndex -= this.clip.frameStep;
                        if (this.clip.looping) {
                            this.loopCount++;
                        }

                        // Check if animation should reset completely
                        const shouldReset =
                            this.frameIndex < 0 ||
                            this.frameIndex >= frameCount ||
                            (this.clip.looping && this.loopCount >= this.clip.maxLoops);

                        if (shouldReset) {
                            this.frameTick = 0;
                            this.frameIndex = 0;
                            this.loopCount = 0;
                        } else {
                            // Valid wrap - keep the wrapped frameIndex, just reset frameTick
                            this.frameTick = 0;
                            // frameIndex is already correctly set from the subtraction above
                        }
                    } else {
                        // No frameStep - reset to beginning
                        this.frameTick = 0;
                        this.frameIndex = 0;
                    }
                }
            }
        }
    }
}
