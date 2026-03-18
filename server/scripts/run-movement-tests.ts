#!/usr/bin/env node

/**
 * Movement Tests Runner
 * Executes all movement system tests
 */
import { runPathDesyncTests } from "../tests/movement-desync.test";
import { runMovementTests } from "../tests/movement.test";
import { runOsrsSampleParityTest } from "../tests/osrs-parity.test";

async function main() {
    let allPassed = true;

    try {
        await runMovementTests();
    } catch (e: any) {
        console.error("\n❌ Movement tests failed");
        console.error(e.message);
        allPassed = false;
    }

    try {
        await runPathDesyncTests();
    } catch (e: any) {
        console.error("\n❌ Path desync tests failed");
        console.error(e.message);
        allPassed = false;
    }

    try {
        await runOsrsSampleParityTest();
    } catch (e: any) {
        console.error("\n❌ OSRS sample parity test failed");
        console.error(e.message);
        allPassed = false;
    }

    if (!allPassed) {
        console.error("\n❌ Some tests failed");
        process.exit(1);
    } else {
        console.log("\n✅ All movement tests passed!");
        process.exit(0);
    }
}

main();
