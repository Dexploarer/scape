"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloatUtil = void 0;
class FloatUtil {
    static floatBitsToInt(n) {
        FloatUtil.float[0] = n;
        return FloatUtil.integer[0];
    }
    static intBitsToFloat(n) {
        FloatUtil.integer[0] = n;
        return FloatUtil.float[0];
    }
    static packFloat11(v) {
        return 1024 - Math.round(v / (1 / 64));
    }
    static unpackFloat11(v) {
        return 16 - v / 64;
    }
    // 0-1, 1/63 decimal precision
    static packFloat6(v) {
        return Math.round(v / (1 / 63));
    }
    static unpackFloat6(v) {
        return v / 63;
    }
}
exports.FloatUtil = FloatUtil;
FloatUtil.MAX_VALUE = 3.4028234663852886e38;
FloatUtil.float = new Float32Array(1);
FloatUtil.integer = new Int32Array(FloatUtil.float.buffer);
