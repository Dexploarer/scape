import assert from "assert";
import { describe, it } from "vitest";

import { LeagueTaskService } from "../src/game/leagues/LeagueTaskService";

function createPlayer() {
    const varps = new Map<number, number>();
    const varbits = new Map<number, number>();
    return {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => {
            varps.set(id, value);
        },
        getVarbitValue: (id: number) => varbits.get(id) ?? 0,
        setVarbitValue: (id: number, value: number) => {
            varbits.set(id, value);
        },
        varps,
        varbits,
    };
}

describe("LeagueTaskService", () => {
    it("completes a task once (bitfield + points + total tasks + notification)", () => {
        const player = createPlayer();

        const first = LeagueTaskService.completeTask(player as any, 189, {
            name: "Open the Leagues Menu",
            points: 10,
        });
        assert.equal(first.changed, true);
        assert.ok(first.notification);
        assert.equal(first.notification?.title, "League Task Completed");
        assert.ok(first.notification?.message.includes("Open the Leagues Menu"));
        assert.ok(first.varpUpdates.length > 0);
        assert.ok(first.varbitUpdates.length > 0);

        const second = LeagueTaskService.completeTask(player as any, 189, {
            name: "Open the Leagues Menu",
            points: 10,
        });
        assert.equal(second.changed, false);
        assert.equal(second.notification, undefined);
        assert.equal(second.varpUpdates.length, 0);
        assert.equal(second.varbitUpdates.length, 0);
    });
});
