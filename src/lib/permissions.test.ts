import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";
import { FEATURES, can, featuresOf, type Feature } from "./permissions";

// Written out by hand from the spec — deliberately NOT derived from
// TIER_FEATURES, so an accidental config change fails this test.
const EXPECTED: Record<Feature, { t1: boolean; t2: boolean; t3: boolean; admin: boolean }> = {
  viewCustomers:       { t1: true,  t2: true,  t3: true,  admin: false },
  createCustomer:      { t1: true,  t2: true,  t3: true,  admin: false },
  createLoan:          { t1: true,  t2: true,  t3: true,  admin: false },
  editCustomer:        { t1: false, t2: false, t3: false, admin: true },
  editLoan:            { t1: false, t2: false, t3: false, admin: true },
  createInvoice:       { t1: true,  t2: true,  t3: true,  admin: false },
  editInvoice:         { t1: false, t2: false, t3: false, admin: true },
  manageCompany:       { t1: false, t2: false, t3: false, admin: true },
  importExcel:         { t1: true,  t2: true,  t3: true,  admin: false },
  viewFinancial:       { t1: false, t2: true,  t3: true,  admin: false },
  editFinancial:       { t1: false, t2: true,  t3: true,  admin: false },
  exportExcel:         { t1: false, t2: true,  t3: true,  admin: false },
  viewOwnHistory:      { t1: true,  t2: true,  t3: true,  admin: false },
  deleteCustomer:      { t1: false, t2: false, t3: false, admin: true },
  bulkDeleteCustomers: { t1: false, t2: false, t3: false, admin: true },
  viewAllHistory:      { t1: false, t2: false, t3: true,  admin: true },
  manageTags:          { t1: false, t2: false, t3: true,  admin: false },
  manageUsers:         { t1: false, t2: false, t3: false, admin: true },
};

const member = (tier: number) => ({ role: "MEMBER", tier });

test("tier × feature matrix matches the spec", () => {
  for (const feature of Object.keys(FEATURES) as Feature[]) {
    const e = EXPECTED[feature];
    assert.equal(can(member(1), feature), e.t1, `T1 ${feature}`);
    assert.equal(can(member(2), feature), e.t2, `T2 ${feature}`);
    assert.equal(can(member(3), feature), e.t3, `T3 ${feature}`);
    // admin column = granted by the ADMIN role on top of the tier
    assert.equal(can({ role: "ADMIN", tier: 1 }, feature), e.t1 || e.admin, `ADMIN+T1 ${feature}`);
  }
});

test("admin role adds admin features on top of its tier", () => {
  const admin1 = { role: "ADMIN", tier: 1 };
  assert.equal(can(admin1, "manageUsers"), true);
  assert.equal(can(admin1, "viewAllHistory"), true);
  assert.equal(can(admin1, "viewCustomers"), true);
  assert.equal(can(admin1, "viewFinancial"), false); // still tier 1 for customer data
  assert.equal(can({ role: "ADMIN", tier: 3 }, "deleteCustomer"), true);
  // Editing/removing existing records is admin-only, whatever the tier
  assert.equal(can(member(3), "editCustomer"), false);
  assert.equal(can(member(3), "deleteCustomer"), false);
  assert.equal(can(member(3), "editLoan"), false);
});

test("fails closed for missing users and unknown tiers", () => {
  assert.deepEqual(featuresOf(null), []);
  assert.deepEqual(featuresOf(undefined), []);
  assert.deepEqual(featuresOf(member(0)), []);
  assert.deepEqual(featuresOf(member(4)), []);
  assert.equal(can(member(Number.NaN), "viewCustomers"), false);
});

// --- Guard coverage: server entry points must check permissions ---

test("every API route is wrapped in withFeature()", () => {
  const routes = globSync("src/app/api/**/route.ts").filter((f) => !f.startsWith("src/app/api/auth/"));
  for (const file of routes) {
    const src = readFileSync(file, "utf8");
    const exportedHandlers = src.match(/export\s+(async\s+)?(function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
    const guarded = src.match(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*withFeature\(/g) ?? [];
    assert.ok(exportedHandlers.length > 0, `${file}: no HTTP handlers found`);
    assert.equal(guarded.length, exportedHandlers.length, `${file}: every handler must be "export const X = withFeature(...)"`);
  }
});

// Server actions that only need a logged-in user (or none, for login itself)
const ACTION_ALLOWLIST = new Set(["src/app/login/actions.ts", "src/app/(app)/layout.tsx"]);

test("every server action file checks permissions", () => {
  const files = globSync("src/**/*.{ts,tsx}").filter((f) => !f.endsWith(".test.ts"));
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (!/["']use server["']/.test(src) || ACTION_ALLOWLIST.has(file)) continue;
    assert.match(src, /requireFeature\(/, `${file}: server actions must call requireFeature()`);
  }
});
