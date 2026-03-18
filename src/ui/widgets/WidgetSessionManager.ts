export type WidgetCloseReason = "user" | "manager" | "server";

export type WidgetSessionEntry = {
    groupId: number;
    modal: boolean;
    close: (reason: WidgetCloseReason) => void;
    open?: () => void;
    /** True once the interface has had its onLoad scripts run for this open session. */
    initialized?: boolean;
};

export class WidgetSessionManager {
    private _entries = new Map<number, WidgetSessionEntry>();
    private suppressNetworkFor: Set<number> = new Set();
    private modalStack: number[] = [];

    private trackModal(gid: number) {
        const id = gid | 0;
        const existingIndex = this.modalStack.indexOf(id);
        if (existingIndex !== -1) {
            this.modalStack.splice(existingIndex, 1);
        }
        this.modalStack.push(id);
    }

    private untrackModal(gid: number) {
        const id = gid | 0;
        for (let i = this.modalStack.length - 1; i >= 0; i--) {
            if (this.modalStack[i] === id) {
                this.modalStack.splice(i, 1);
            }
        }
    }

    private getTopModalGroupId(): number | undefined {
        for (let i = this.modalStack.length - 1; i >= 0; i--) {
            const gid = this.modalStack[i];
            const entry = this._entries.get(gid);
            if (entry && entry.modal) {
                return gid;
            }
            this.modalStack.splice(i, 1);
        }
        return undefined;
    }

    open(groupId: number, entry: Omit<WidgetSessionEntry, "groupId">): void {
        const gid = groupId | 0;
        const record: WidgetSessionEntry = {
            groupId: gid,
            modal: !!entry.modal,
            close: entry.close,
            open: entry.open,
            initialized: false,
        };
        this._entries.set(gid, record);
        this.untrackModal(gid);
        if (record.modal) {
            this.trackModal(gid);
        }
        console.log("[widget-session] open", { groupId: gid, modal: record.modal });
    }

    needsInit(groupId: number): boolean {
        const entry = this._entries.get(groupId | 0);
        return !!entry && entry.initialized !== true;
    }

    markInitialized(groupId: number): void {
        const entry = this._entries.get(groupId | 0);
        if (entry) entry.initialized = true;
    }

    close(groupId: number, reason: WidgetCloseReason = "user"): void {
        const gid = groupId | 0;
        const entry = this._entries.get(gid);
        if (!entry) return;
        this._entries.delete(gid);
        this.untrackModal(gid);
        console.log("[widget-session] close", { groupId: gid, reason });
        try {
            entry.close(reason);
        } catch (err) {
            console.warn("[widget-session] close callback threw", err);
        }
    }

    isOpen(groupId: number): boolean {
        return this._entries.has(groupId | 0);
    }

    closeModal(reason: WidgetCloseReason = "manager"): number[] {
        const closed: number[] = [];
        while (true) {
            const gid = this.getTopModalGroupId();
            if (gid === undefined) break;
            closed.push(gid);
            console.log("[widget-session] closeModal", { groupId: gid, reason });
            this.close(gid, reason);
        }
        return closed;
    }

    hasOpenModal(): boolean {
        for (let i = this.modalStack.length - 1; i >= 0; i--) {
            const gid = this.modalStack[i];
            const entry = this._entries.get(gid);
            if (entry && entry.modal) return true;
            this.modalStack.splice(i, 1);
        }
        return false;
    }

    closeTopModal(reason: WidgetCloseReason = "user"): number | undefined {
        const gid = this.getTopModalGroupId();
        if (gid === undefined) {
            return undefined;
        }
        console.log("[widget-session] closeTopModal", { groupId: gid, reason });
        this.close(gid, reason);
        return gid;
    }

    forceClose(groupId: number): void {
        const gid = groupId | 0;
        const entry = this._entries.get(gid);
        if (!entry) return;
        this._entries.delete(gid);
        this.suppressNetworkFor.add(gid);
        this.untrackModal(gid);
        console.log("[widget-session] forceClose", { groupId: gid });
        try {
            entry.close("server");
        } catch (err) {
            console.warn("[widget-session] force close callback threw", err);
        } finally {
            this.suppressNetworkFor.delete(gid);
        }
    }

    shouldSuppressNetwork(groupId: number): boolean {
        return this.suppressNetworkFor.has(groupId | 0);
    }

    acknowledgeOpen(
        groupId: number,
        opts: { modal?: boolean; triggerOpen?: boolean } = {},
    ): boolean {
        const gid = groupId | 0;
        const entry = this._entries.get(gid);
        if (!entry) return false;
        if (typeof opts.modal === "boolean") {
            entry.modal = !!opts.modal;
            this.untrackModal(gid);
            if (entry.modal) {
                this.trackModal(gid);
            }
        }
        if (opts.triggerOpen) {
            try {
                entry.open?.();
            } catch (err) {
                console.warn("[widget-session] open callback threw", err);
            }
        }
        return true;
    }
}
