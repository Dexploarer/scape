import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

export class BasType extends Type {
    idleSeqId = -1;
    walkSeqId = -1;
    crawlSeqId = -1;
    crawlBackSeqId = -1;
    crawlLeftSeqId = -1;
    crawlRightSeqId = -1;
    runSeqId = -1;
    runBackSeqId = -1;
    runLeftSeqId = -1;
    runRightSeqId = -1;
    walkBackSeqId = -1;
    walkLeftSeqId = -1;
    walkRightSeqId = -1;
    idleLeftSeqId = -1;
    idleRightSeqId = -1;

    modelRotateTranslate?: number[][];

    // Turning behaviour (OSRS BAS). Units match RS engine:
    // yawAcceleration in arbitrary units and yawMaxSpeed in 0..2047 per full circle
    yawAcceleration: number = 0;
    yawMaxSpeed: number = 0;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.idleSeqId = buffer.readUnsignedShort();
            this.walkSeqId = buffer.readUnsignedShort();
            if (this.idleSeqId === 0xffff) {
                this.idleSeqId = -1;
            }
            if (this.walkSeqId === 0xffff) {
                this.walkSeqId = -1;
            }
        } else if (opcode === 2) {
            this.crawlSeqId = buffer.readUnsignedShort();
            if (this.crawlSeqId === 0xffff) this.crawlSeqId = -1;
        } else if (opcode === 3) {
            this.crawlBackSeqId = buffer.readUnsignedShort();
            if (this.crawlBackSeqId === 0xffff) this.crawlBackSeqId = -1;
        } else if (opcode === 4) {
            this.crawlLeftSeqId = buffer.readUnsignedShort();
            if (this.crawlLeftSeqId === 0xffff) this.crawlLeftSeqId = -1;
        } else if (opcode === 5) {
            this.crawlRightSeqId = buffer.readUnsignedShort();
            if (this.crawlRightSeqId === 0xffff) this.crawlRightSeqId = -1;
        } else if (opcode === 6) {
            this.runSeqId = buffer.readUnsignedShort();
            if (this.runSeqId === 0xffff) this.runSeqId = -1;
        } else if (opcode === 7) {
            this.runBackSeqId = buffer.readUnsignedShort();
            if (this.runBackSeqId === 0xffff) this.runBackSeqId = -1;
        } else if (opcode === 8) {
            this.runLeftSeqId = buffer.readUnsignedShort();
            if (this.runLeftSeqId === 0xffff) this.runLeftSeqId = -1;
        } else if (opcode === 9) {
            this.runRightSeqId = buffer.readUnsignedShort();
            if (this.runRightSeqId === 0xffff) this.runRightSeqId = -1;
        } else if (opcode === 26) {
            const anInt1059 = buffer.readUnsignedByte() * 4;
            const anInt1050 = buffer.readUnsignedByte() * 4;
        } else if (opcode === 27) {
            if (!this.modelRotateTranslate) {
                this.modelRotateTranslate = new Array(12);
            }
            const bodyPartId = buffer.readUnsignedByte();
            this.modelRotateTranslate[bodyPartId] = new Array(6);
            for (let type = 0; type < 6; type++) {
                /*
                 * 0 -Rotate X
                 * 1 - Rotate Y
                 * 2 - Rotate Z
                 * 3 - Translate X
                 * 4 - Translate Y
                 * 5 - Translate Z
                 */
                this.modelRotateTranslate[bodyPartId][type] = buffer.readShort();
            }
        } else if (opcode === 29) {
            this.yawAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 30) {
            this.yawMaxSpeed = buffer.readUnsignedShort();
        } else if (opcode === 31) {
            const rollAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 32) {
            const rollMaxSpeed = buffer.readUnsignedShort();
        } else if (opcode === 33) {
            const rollTargetAngle = buffer.readShort();
        } else if (opcode === 34) {
            const pitchAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 35) {
            const pitchMaxSpeed = buffer.readUnsignedShort();
        } else if (opcode === 36) {
            const pitchTargetAngle = buffer.readShort();
        } else if (opcode === 37) {
            const movementAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 38) {
            this.idleLeftSeqId = buffer.readUnsignedShort();
            if (this.idleLeftSeqId === 0xffff) this.idleLeftSeqId = -1;
        } else if (opcode === 39) {
            this.idleRightSeqId = buffer.readUnsignedShort();
            if (this.idleRightSeqId === 0xffff) this.idleRightSeqId = -1;
        } else if (opcode === 40) {
            this.walkBackSeqId = buffer.readUnsignedShort();
            if (this.walkBackSeqId === 0xffff) this.walkBackSeqId = -1;
        } else if (opcode === 41) {
            this.walkLeftSeqId = buffer.readUnsignedShort();
            if (this.walkLeftSeqId === 0xffff) this.walkLeftSeqId = -1;
        } else if (opcode === 42) {
            this.walkRightSeqId = buffer.readUnsignedShort();
            if (this.walkRightSeqId === 0xffff) this.walkRightSeqId = -1;
        } else if (opcode === 43) {
            buffer.readUnsignedShort();
        } else if (opcode === 44) {
            buffer.readUnsignedShort();
        } else if (opcode === 45) {
            buffer.readUnsignedShort();
        } else if (opcode === 46) {
            const anInt203 = buffer.readUnsignedShort();
        } else if (opcode === 47) {
            const anInt198 = buffer.readUnsignedShort();
        } else if (opcode === 48) {
            const anInt194 = buffer.readUnsignedShort();
        } else if (opcode === 49) {
            const anInt211 = buffer.readUnsignedShort();
        } else if (opcode === 50) {
            const anInt202 = buffer.readUnsignedShort();
        } else if (opcode === 51) {
            const anInt222 = buffer.readUnsignedShort();
        } else if (opcode === 52) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                buffer.readUnsignedShort();
                buffer.readUnsignedByte();
            }
        } else if (opcode === 53) {
            const bool = false;
        } else if (opcode === 54) {
            const v0 = buffer.readUnsignedByte() << 6;
            const v1 = buffer.readUnsignedByte() << 6;
        } else if (opcode === 55) {
            const bodyPartId = buffer.readUnsignedByte();
            buffer.readUnsignedShort();
        } else if (opcode === 56) {
            const bodyPartId = buffer.readUnsignedByte();
            for (let i = 0; i < 3; i++) {
                buffer.readShort();
            }
        } else {
            throw new Error("BasType: Unknown opcode: " + opcode);
        }
    }
}
