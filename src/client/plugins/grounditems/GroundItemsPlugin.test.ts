import type { ClientGroundItemStack } from "../../data/ground/GroundItemStore";
import { GroundItemsPlugin } from "./GroundItemsPlugin";

function makeStack(overrides: Partial<ClientGroundItemStack> = {}): ClientGroundItemStack {
    return {
        id: 1,
        itemId: 561,
        quantity: 1,
        tile: { x: 3200, y: 3200, level: 0 },
        name: "Nature rune",
        gePrice: 220,
        haPrice: 0,
        tradeable: true,
        ...overrides,
    };
}

describe("GroundItemsPlugin", () => {
    test("explicit highlight overrides hide-under-value filtering", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            hideUnderValue: 10_000_000,
            highlightedItems: "Nature rune",
        });

        const evaluation = plugin.evaluateStack(makeStack());
        expect(evaluation.highlighted).toBe(true);
        expect(plugin.shouldDisplayStack(makeStack())).toBe(true);
    });

    test("explicit hidden items are not tier-highlighted", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            hiddenItems: "Rune platebody",
            lowValuePrice: 100,
        });
        const stack = makeStack({
            name: "Rune platebody",
            gePrice: 38_000,
            haPrice: 38_400,
        });
        const evaluation = plugin.evaluateStack(stack);
        expect(evaluation.hidden).toBe(true);
        expect(evaluation.highlighted).toBe(false);
    });

    test("show highlighted only hides non-highlighted items", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            showHighlightedOnly: true,
            highlightedItems: "Law rune",
        });
        expect(plugin.shouldDisplayStack(makeStack())).toBe(false);
    });

    test("price display includes GE and HA in both mode", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({ priceDisplayMode: "both" });
        const evaluation = plugin.evaluateStack(
            makeStack({
                name: "Adamant platebody",
                gePrice: 9800,
                haPrice: 7680,
            }),
        );
        expect(evaluation.label).toContain("GE:");
        expect(evaluation.label).toContain("HA:");
    });

    test("wildcard patterns match case-insensitively", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            highlightedItems: "dragon *",
        });
        const evaluation = plugin.evaluateStack(
            makeStack({
                name: "Dragon med helm",
            }),
        );
        expect(evaluation.highlighted).toBe(true);
    });

    test("quantity operators apply to highlighted and hidden lists", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            highlightedItems: "Coins>5000",
            hiddenItems: "Coins<100",
        });

        const lowCoins = makeStack({
            itemId: 995,
            name: "Coins",
            quantity: 50,
            gePrice: 1,
            haPrice: 0,
        });
        const highCoins = makeStack({
            itemId: 995,
            name: "Coins",
            quantity: 6000,
            gePrice: 1,
            haPrice: 0,
        });

        expect(plugin.evaluateStack(lowCoins).hidden).toBe(true);
        expect(plugin.evaluateStack(highCoins).highlighted).toBe(true);
    });

    test("quoted entries are exact matches, not wildcard patterns", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            highlightedItems: '"Dragon *"',
        });

        const exact = makeStack({ name: "Dragon *" });
        const wildcardLike = makeStack({ name: "Dragon dagger" });

        expect(plugin.evaluateStack(exact).highlighted).toBe(true);
        expect(plugin.evaluateStack(wildcardLike).highlighted).toBe(false);
    });

    test("value tiers use inclusive thresholds", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({
            lowValuePrice: 100,
            mediumValuePrice: 1000,
            highValuePrice: 10_000,
            insaneValuePrice: 100_000,
            lowValueColor: 0x123456,
        });
        const atLowThreshold = makeStack({
            gePrice: 100,
            quantity: 1,
        });

        const evaluation = plugin.evaluateStack(atLowThreshold);
        expect(evaluation.highlighted).toBe(true);
        expect(evaluation.color).toBe(0x123456);
    });

    test("menu quantity labels can be toggled", () => {
        const plugin = new GroundItemsPlugin();
        const stack = makeStack({
            quantity: 12345,
        });

        plugin.setConfig({ showMenuItemQuantities: true });
        expect(plugin.getMenuTargetName(stack)).toBe("Nature rune (12,345)");

        plugin.setConfig({ showMenuItemQuantities: false });
        expect(plugin.getMenuTargetName(stack)).toBe("Nature rune");
    });

    test("ownership filter hides non-drop ownership in drops mode", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({ ownershipFilterMode: "drops" });

        const selfOwned = makeStack({ ownership: 1 });
        const noneOwned = makeStack({ ownership: 0 });

        expect(plugin.shouldDisplayStack(selfOwned)).toBe(true);
        expect(plugin.shouldDisplayStack(noneOwned)).toBe(false);
    });

    test("ownership filter in takeable mode respects account type parity", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({ ownershipFilterMode: "takeable" });

        const otherOwned = makeStack({ ownership: 2 });
        const selfOwned = makeStack({ ownership: 1 });

        // Main account: other-owned public items are takeable.
        expect(plugin.shouldDisplayStack(otherOwned)).toBe(true);
        expect(plugin.shouldDisplayStack(selfOwned)).toBe(true);
        // Iron account: other-owned items stay hidden in takeable mode.
        expect(plugin.shouldDisplayStack(otherOwned, { accountType: 1 })).toBe(false);
        expect(plugin.shouldDisplayStack(selfOwned, { accountType: 1 })).toBe(true);
    });

    test("timer label appends seconds when enabled", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({ despawnTimerMode: "seconds" });
        const stack = makeStack({
            expiresTick: 110,
        });

        const evaluation = plugin.evaluateStack(stack, {
            includeTimerLabel: true,
            timing: {
                currentTick: 100,
                tickPhase: 0,
                tickMs: 600,
            },
        });

        expect(evaluation.label).toContain(" - 6.0");
    });

    test("timer label appends ticks when enabled", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({ despawnTimerMode: "ticks" });
        const stack = makeStack({
            expiresTick: 110,
        });

        const evaluation = plugin.evaluateStack(stack, {
            includeTimerLabel: true,
            timing: {
                currentTick: 100,
                tickPhase: 0,
            },
        });

        expect(evaluation.label).toContain(" - 10");
    });

    test("timer color changes from private to public phase", () => {
        const plugin = new GroundItemsPlugin();
        plugin.setConfig({ despawnTimerMode: "ticks" });
        const stack = makeStack({
            privateUntilTick: 105,
            expiresTick: 110,
        });

        const privatePhase = plugin.evaluateStack(stack, {
            includeTimerLabel: true,
            timing: {
                currentTick: 100,
                tickPhase: 0,
            },
        });
        const publicPhase = plugin.evaluateStack(stack, {
            includeTimerLabel: true,
            timing: {
                currentTick: 106,
                tickPhase: 0,
            },
        });

        expect(privatePhase.timerColor).toBe(0x00ff00);
        expect(publicPhase.timerColor).toBe(0xffff00);
    });
});
