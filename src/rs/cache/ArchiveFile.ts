import { ByteBuffer } from "../io/ByteBuffer";

export class ArchiveFile {
    private _data?: Int8Array;
    private _provider?: () => Int8Array;

    constructor(
        readonly id: number,
        readonly archiveId: number,
        dataOrProvider: Int8Array | (() => Int8Array),
    ) {
        if (dataOrProvider instanceof Int8Array) {
            this._data = dataOrProvider;
        } else {
            this._provider = dataOrProvider;
        }
    }

    get data(): Int8Array {
        if (!this._data) {
            this._data = this._provider!();
            this._provider = undefined;
        }
        return this._data;
    }

    getDataAsBuffer(): ByteBuffer {
        return new ByteBuffer(this.data);
    }
}
