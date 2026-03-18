export class Node {
    next: Node | null = null;
    prev: Node | null = null;
}

class SentinelNode extends Node {
    declare next: Node;
    declare prev: Node;

    constructor() {
        super();
        this.next = this;
        this.prev = this;
    }
}

export class NodeDeque {
    sentinel: SentinelNode;

    constructor() {
        this.sentinel = new SentinelNode();
    }

    addLast(node: Node): void {
        if (node.prev || node.next) this.remove(node);
        node.prev = this.sentinel.prev;
        node.next = this.sentinel;
        this.sentinel.prev.next = node;
        this.sentinel.prev = node;
    }

    last(): Node | null {
        const n = this.sentinel.prev;
        return n === this.sentinel ? null : n;
    }

    previous(node: Node): Node | null {
        const n = node.prev;
        return n === this.sentinel ? null : n;
    }

    remove(node: Node): void {
        if (!node.prev || !node.next) return;
        node.prev.next = node.next;
        node.next.prev = node.prev;
        node.prev = node.next = null;
    }
}
