import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import {
  FREE_FEATURE_LIST,
  PRO_FEATURE_LIST,
  PRO_FEATURES,
  isProStatus,
} from "../src/lib/entitlements.js";
import {
  REVENUE_EVENTS,
  trackRevenueEvent,
  getRevenueEvents,
  clearRevenueEvents,
} from "../src/lib/revenueAnalytics.js";
import { assertProProfile } from "../api/_lib/assertProProfile.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

function mockLocalStorage() {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
  };
  return store;
}

await check("free list keeps core logging unlimited", () => {
  assert.ok(FREE_FEATURE_LIST.some((f) => /workout logging/i.test(f)));
  assert.ok(FREE_FEATURE_LIST.some((f) => /nutrition/i.test(f)));
  assert.equal(FREE_FEATURE_LIST.includes("Voice fitness assistant"), false);
});

await check("pro catalog covers voice, AI, and analytics", () => {
  for (const id of ["voice", "ai_chat", "food_scan", "workout_converter", "advanced_analytics"]) {
    assert.ok(PRO_FEATURES[id], `missing PRO_FEATURES.${id}`);
  }
  assert.ok(PRO_FEATURE_LIST.some((f) => /voice/i.test(f)));
  assert.ok(PRO_FEATURE_LIST.some((f) => /analytics/i.test(f)));
});

await check("isProStatus only treats explicit pro as paid", () => {
  assert.equal(isProStatus(true), true);
  assert.equal(isProStatus("pro"), true);
  assert.equal(isProStatus(false), false);
  assert.equal(isProStatus(null), false);
  assert.equal(isProStatus("free"), false);
});

await check("revenue funnel events persist locally", () => {
  mockLocalStorage();
  clearRevenueEvents();
  trackRevenueEvent(REVENUE_EVENTS.PAYWALL_VIEWED, { feature: "voice" });
  trackRevenueEvent(REVENUE_EVENTS.UPGRADE_INITIATED, { feature: "voice" });
  trackRevenueEvent(REVENUE_EVENTS.PURCHASE_COMPLETED, { product: "armpal_pro" });
  trackRevenueEvent(REVENUE_EVENTS.PURCHASE_RESTORED, { product: "armpal_pro" });
  trackRevenueEvent(REVENUE_EVENTS.PRO_ACTIVE, { source: "unlock" });
  const events = getRevenueEvents();
  assert.deepEqual(
    events.map((e) => e.name),
    [
      "paywall_viewed",
      "upgrade_initiated",
      "purchase_completed",
      "purchase_restored",
      "pro_active",
    ]
  );
  assert.equal(events[0].props.feature, "voice");
  clearRevenueEvents();
  assert.equal(getRevenueEvents().length, 0);
});

await check("assertProProfile rejects missing user", async () => {
  const result = await assertProProfile({}, null);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.error, "PRO_REQUIRED");
});

await check("assertProProfile rejects free profiles", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: { is_pro: false }, error: null }),
      };
    },
  };
  const result = await assertProProfile(supabase, "user-1");
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.error, "PRO_REQUIRED");
});

await check("assertProProfile allows is_pro profiles", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: { is_pro: true }, error: null }),
      };
    },
  };
  const result = await assertProProfile(supabase, "user-1");
  assert.equal(result.ok, true);
});

await check("existing StoreKit product id is reused, not duplicated", () => {
  const purchaseManager = readFileSync(join(root, "src/services/purchaseManager.js"), "utf8");
  assert.match(purchaseManager, /IOS_PRODUCT_ID = "armpal_pro"/);
  const session = readFileSync(join(root, "api/realtime/session.js"), "utf8");
  assert.match(session, /requireProUser/);
  const tools = readFileSync(join(root, "api/realtime/tools.js"), "utf8");
  assert.match(tools, /requireProUser/);
  const foodScan = readFileSync(join(root, "api/ai/food-scan.js"), "utf8");
  assert.match(foodScan, /assertProProfile/);
});

console.log(`\n${passed} checks passed`);
