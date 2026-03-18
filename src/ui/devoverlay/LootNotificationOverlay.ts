import type { NotificationEvent } from "../../network/ServerConnection";

/**
 * A single loot notification to display.
 */
export interface LootNotification {
    id: number;
    message: string;
    title?: string;
    itemId?: number;
    quantity?: number;
    expiresAt: number;
}

/**
 * Simple DOM-based loot notification overlay.
 * Displays pickup notifications in the top-right corner of the screen.
 */
export class LootNotificationOverlay {
    private notifications: LootNotification[] = [];
    private nextId = 0;
    private maxVisible = 5;
    private defaultDuration = 3000;
    private container: HTMLDivElement | null = null;
    private updateInterval: number | null = null;

    /**
     * Initialize the notification overlay and attach to a parent element.
     * @param parent The parent element to attach the notification container to
     */
    init(parent: HTMLElement): void {
        // Create container for notifications
        this.container = document.createElement("div");
        this.container.id = "loot-notification-overlay";
        this.container.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: 'RuneScape', 'Runescape', sans-serif;
        `;
        parent.appendChild(this.container);

        // Start update loop
        this.updateInterval = window.setInterval(() => this.update(), 100);
    }

    /**
     * Clean up the overlay.
     */
    dispose(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.container = null;
        this.notifications = [];
    }

    /**
     * Add a notification from a server event.
     */
    add(event: NotificationEvent): void {
        const notification: LootNotification = {
            id: this.nextId++,
            message: event.message,
            title: event.title,
            itemId: event.itemId,
            quantity: event.quantity,
            expiresAt: Date.now() + (event.durationMs ?? this.defaultDuration),
        };

        this.notifications.push(notification);

        // Trim old notifications if we exceed max
        while (this.notifications.length > this.maxVisible) {
            this.notifications.shift();
        }

        this.render();
    }

    /**
     * Update notifications (remove expired).
     */
    private update(): void {
        const now = Date.now();
        const before = this.notifications.length;
        // PERF: Filter in-place to avoid creating new array every frame
        let writeIdx = 0;
        for (let i = 0; i < this.notifications.length; i++) {
            if (this.notifications[i].expiresAt > now) {
                this.notifications[writeIdx++] = this.notifications[i];
            }
        }
        this.notifications.length = writeIdx;
        if (this.notifications.length !== before) {
            this.render();
        }
    }

    /**
     * Render all active notifications.
     */
    private render(): void {
        if (!this.container) return;

        // Clear existing
        this.container.innerHTML = "";

        // Render each notification
        for (const notif of this.notifications) {
            const el = document.createElement("div");
            el.style.cssText = `
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid #3e3529;
                border-radius: 3px;
                padding: 6px 12px;
                min-width: 150px;
                box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
            `;

            // Title
            if (notif.title) {
                const titleEl = document.createElement("div");
                titleEl.style.cssText = `
                    color: #ffff00;
                    font-size: 12px;
                    font-weight: bold;
                    margin-bottom: 2px;
                `;
                titleEl.textContent = notif.title;
                el.appendChild(titleEl);
            }

            // Message
            const msgEl = document.createElement("div");
            msgEl.style.cssText = `
                color: #ffffff;
                font-size: 12px;
            `;
            msgEl.textContent = notif.message;
            el.appendChild(msgEl);

            this.container.appendChild(el);
        }
    }
}

// Singleton instance for easy access
let instance: LootNotificationOverlay | null = null;

/**
 * Get or create the singleton notification overlay.
 */
export function getLootNotificationOverlay(): LootNotificationOverlay {
    if (!instance) {
        instance = new LootNotificationOverlay();
    }
    return instance;
}

/**
 * Dispose the singleton instance.
 */
export function disposeLootNotificationOverlay(): void {
    if (instance) {
        instance.dispose();
        instance = null;
    }
}
