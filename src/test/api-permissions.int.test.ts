// Tier permissions enforced by the real route handlers and server actions,
// called the way a client could call them directly (bypassing the UI).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { ForbiddenError, expectRedirect, setupIntegration, type TestUsers } from "./harness";

const FINANCIAL_KEYS = ["creditLimit", "paymentTermDays", "outstandingBalance"];
const FINANCIAL_LABELS = ["วงเงินเครดิต", "เงื่อนไขชำระเงิน (วัน)", "ยอดค้างชำระ"];
// Distinctive values so a leak shows up anywhere in a response body
const CREDIT = "98765.43";
const BALANCE = "4321.09";
const TERM = 47;

let h: Awaited<ReturnType<typeof setupIntegration>>;
let users: TestUsers;
let customerId: string;
type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
let routes: Record<"list" | "detail" | "export" | "template" | "importFile", Handler>;
let actions: typeof import("@/server/customers/actions");

before(async () => {
  h = await setupIntegration();
  users = h.users;
  routes = {
    list: (await import("@/app/api/customers/route")).GET,
    detail: (await import("@/app/api/customers/[id]/route")).GET,
    export: (await import("@/app/api/customers/export/route")).GET,
    template: (await import("@/app/api/import/template/route")).GET,
    importFile: (await import("@/app/api/import/[id]/file/route")).GET,
  };
  actions = await import("@/server/customers/actions");

  const c = await h.db.customer.create({
    data: {
      code: "C00001",
      name: "บริษัท ทดสอบสิทธิ์ จำกัด",
      phone: "081-111-2222",
      phoneNormalized: "0811112222",
      taxId: "0105536009604",
      branchCode: "00000",
      creditLimit: CREDIT,
      paymentTermDays: TERM,
      outstandingBalance: BALANCE,
      createdById: users.tier3.id,
    },
  });
  customerId = c.id;
});

after(() => h.cleanup());

function call(handler: Handler, url: string, params: Record<string, string> = {}) {
  return handler(new NextRequest(new URL(url, "http://localhost")), { params: Promise.resolve(params) });
}

function assertNoFinancialLeak(body: string, where: string) {
  for (const needle of [...FINANCIAL_KEYS, CREDIT, BALANCE, "98765", "4321"]) {
    assert.ok(!body.includes(needle), `${where}: response contains "${needle}"`);
  }
}

function sheetRows(buf: ArrayBuffer, sheet = "ลูกค้า") {
  const wb = XLSX.read(new Uint8Array(buf));
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet]);
}

function sheetHeaders(buf: ArrayBuffer, sheet = "ลูกค้า") {
  const wb = XLSX.read(new Uint8Array(buf));
  return (XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheet], { header: 1 })[0] ?? []).map(String);
}

describe("not logged in / inactive", () => {
  for (const [name, user] of [
    ["logged out", null],
    ["deactivated account", "inactiveTier3"],
  ] as const) {
    test(`${name}: every API route answers 401`, async () => {
      h.loginAs(user && users[user]);
      for (const [route, url, params] of [
        [routes.list, "/api/customers", {}],
        [routes.detail, `/api/customers/${customerId}`, { id: customerId }],
        [routes.export, "/api/customers/export", {}],
        [routes.template, "/api/import/template", {}],
        [routes.importFile, "/api/import/x/file", { id: "x" }],
      ] as const) {
        const res = await call(route, url, params);
        assert.equal(res.status, 401, url);
        assertNoFinancialLeak(await res.text(), url);
      }
    });
  }

  test("logged out: server actions redirect to /login", async () => {
    h.loginAs(null);
    assert.equal(await expectRedirect(actions.deleteCustomer(customerId)), "/login");
  });
});

describe("tier 1 cannot get financial data through the API", () => {
  before(() => h.loginAs(users.tier1));

  test("GET /api/customers: financial is null and no financial value appears in the body", async () => {
    const res = await call(routes.list, "/api/customers");
    assert.equal(res.status, 200);
    const body = await res.text();
    const json = JSON.parse(body);
    assert.equal(json.customers.length, 1);
    assert.equal(json.customers[0].financial, null);
    assertNoFinancialLeak(body, "list");
  });

  test("GET /api/customers: searching by a financial value does not reveal it", async () => {
    for (const q of [CREDIT, BALANCE, "98765"]) {
      const res = await call(routes.list, `/api/customers?q=${q}`);
      const json = await res.json();
      assert.equal(json.total, 0, `q=${q} must not match on financial columns`);
    }
  });

  test("GET /api/customers/:id: financial is null and no financial value appears in the body", async () => {
    const res = await call(routes.detail, `/api/customers/${customerId}`, { id: customerId });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.equal(JSON.parse(body).financial, null);
    assertNoFinancialLeak(body, "detail");
  });

  test("extra query params cannot switch financial fields on", async () => {
    for (const url of [
      `/api/customers?financial=1&select=creditLimit&include=financial`,
      `/api/customers?tier=3&role=ADMIN`,
    ]) {
      const res = await call(routes.list, url);
      assertNoFinancialLeak(await res.text(), url);
    }
  });

  test("GET /api/customers/export: 403 (export is tier 2+)", async () => {
    const res = await call(routes.export, "/api/customers/export");
    assert.equal(res.status, 403);
    assert.equal((await res.json()).feature, "exportExcel");
    assert.equal(await h.db.exportLog.count({ where: { userId: users.tier1.id } }), 0, "a refused export is not logged");
  });

  test("GET /api/import/template: no financial columns", async () => {
    const res = await call(routes.template, "/api/import/template");
    assert.equal(res.status, 200);
    const headers = sheetHeaders(await res.arrayBuffer());
    assert.ok(headers.includes("ชื่อลูกค้า"));
    for (const label of FINANCIAL_LABELS) assert.ok(!headers.includes(label), label);
  });

  test("updateCustomer: financial form fields are ignored", async () => {
    const form = new FormData();
    form.set("name", "บริษัท ทดสอบสิทธิ์ จำกัด");
    form.set("phone", "081-111-2222");
    form.set("taxId", "0105536009604");
    form.set("branchType", "head");
    form.set("creditLimit", "1");
    form.set("paymentTermDays", "1");
    form.set("outstandingBalance", "1");
    await expectRedirect(actions.updateCustomer(customerId, {}, form));

    const c = await h.db.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(c.creditLimit?.toFixed(2), CREDIT);
    assert.equal(c.paymentTermDays, TERM);
    assert.equal(c.outstandingBalance.toFixed(2), BALANCE);
  });

  test("deleteCustomer: forbidden (tier 3 only)", async () => {
    await assert.rejects(actions.deleteCustomer(customerId), ForbiddenError);
    const c = await h.db.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(c.deletedAt, null);
  });
});

describe("tier 2", () => {
  before(() => h.loginAs(users.tier2));

  test("GET /api/customers and /:id include financial data", async () => {
    const list = await (await call(routes.list, "/api/customers")).json();
    assert.deepEqual(list.customers[0].financial, { creditLimit: CREDIT, paymentTermDays: TERM, outstandingBalance: BALANCE });
    const one = await (await call(routes.detail, `/api/customers/${customerId}`, { id: customerId })).json();
    assert.equal(one.financial.creditLimit, CREDIT);
  });

  test("GET /api/customers/export: file includes financial columns and is logged", async () => {
    const res = await call(routes.export, "/api/customers/export?q=ทดสอบ");
    assert.equal(res.status, 200);
    const [row] = sheetRows(await res.arrayBuffer());
    assert.equal(row["วงเงินเครดิต"], Number(CREDIT));
    assert.equal(row["ยอดค้างชำระ"], Number(BALANCE));
    assert.equal(row["เบอร์โทร"], "081-111-2222");

    const log = await h.db.exportLog.findFirstOrThrow({ where: { userId: users.tier2.id } });
    assert.equal(log.rowCount, 1);
    assert.equal(log.includesFinancial, true);
    assert.deepEqual(JSON.parse(log.filters), { q: "ทดสอบ", tags: [] });
  });

  test("GET /api/import/template: includes financial columns", async () => {
    const headers = sheetHeaders(await (await call(routes.template, "/api/import/template")).arrayBuffer());
    for (const label of FINANCIAL_LABELS) assert.ok(headers.includes(label), label);
  });

  test("deleteCustomer: still forbidden", async () => {
    await assert.rejects(actions.deleteCustomer(customerId), ForbiddenError);
  });
});

describe("tier 3", () => {
  before(() => h.loginAs(users.tier3));

  test("deleteCustomer: allowed (soft delete + audit log)", async () => {
    const extra = await h.db.customer.create({ data: { code: "C00099", name: "ลบได้", createdById: users.tier3.id } });
    assert.equal(await expectRedirect(actions.deleteCustomer(extra.id)), "/customers");
    const c = await h.db.customer.findUniqueOrThrow({ where: { id: extra.id } });
    assert.ok(c.deletedAt);
    assert.equal(await h.db.auditLog.count({ where: { customerId: extra.id, action: "DELETE" } }), 1);
  });
});

describe("admin role on tier 1", () => {
  before(() => h.loginAs(users.adminTier1));

  test("admin role does not unlock financial data — tier decides", async () => {
    const res = await call(routes.list, "/api/customers");
    assertNoFinancialLeak(await res.text(), "admin-t1 list");
    assert.equal((await call(routes.export, "/api/customers/export")).status, 403);
  });

  test("can see others' import logs but not download their files (may hold financial data)", async () => {
    const log = await h.db.importLog.create({
      data: { userId: users.tier2.id, fileName: "x.xlsx", fileSize: 1, fileStored: true, headers: "[]", rows: "[]" },
    });
    const res = await call(routes.importFile, `/api/import/${log.id}/file`, { id: log.id });
    assert.equal(res.status, 403);
  });

  test("tier 1 member gets 404 for someone else's import file (indistinguishable from missing)", async () => {
    h.loginAs(users.tier1);
    const log = await h.db.importLog.findFirstOrThrow({ where: { userId: users.tier2.id } });
    const res = await call(routes.importFile, `/api/import/${log.id}/file`, { id: log.id });
    assert.equal(res.status, 404);
  });
});

describe("tier changes apply on the next request", () => {
  test("promoting tier 1 → 2 grants financial data; demoting revokes it", async () => {
    h.loginAs(users.tier1);
    const fetchFinancial = async () => (await (await call(routes.list, "/api/customers")).json()).customers[0].financial;

    assert.equal(await fetchFinancial(), null);
    await h.db.user.update({ where: { id: users.tier1.id }, data: { tier: 2 } });
    assert.equal((await fetchFinancial()).creditLimit, CREDIT);
    await h.db.user.update({ where: { id: users.tier1.id }, data: { tier: 1 } });
    assert.equal(await fetchFinancial(), null);
  });

  test("unknown tier fails closed", async () => {
    await h.db.user.update({ where: { id: users.tier1.id }, data: { tier: 9 } });
    h.loginAs(users.tier1);
    assert.equal((await call(routes.list, "/api/customers")).status, 403);
    await h.db.user.update({ where: { id: users.tier1.id }, data: { tier: 1 } });
  });
});
