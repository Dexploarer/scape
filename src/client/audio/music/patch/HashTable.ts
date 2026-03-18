export class HashTable<T extends { next?: T | null; prev?: T | null; key?: number | string }> {
    private buckets: Array<T | null>;
    private sizeMask: number;

    constructor(size: number = 128) {
        // size must be power of two
        let pow = 1;
        while (pow < size) pow <<= 1;
        this.buckets = new Array(pow).fill(null);
        this.sizeMask = pow - 1;
    }

    private index(key: number): number {
        return key & this.sizeMask;
    }

    get(key: number): T | null {
        let node = this.buckets[this.index(key)];
        while (node) {
            if (node.key === key) return node;
            node = node.next ? node.next : null;
        }
        return null;
    }

    put(node: T, key: number): void {
        node.key = key;
        const idx = this.index(key);
        node.next = this.buckets[idx];
        if (node.next) node.next.prev = node;
        node.prev = null;
        this.buckets[idx] = node;
    }
}
