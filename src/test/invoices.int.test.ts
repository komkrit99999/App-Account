// Tax invoices and company settings through the real server actions, queries
// and logo route.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ForbiddenError, expectRedirect, setupIntegration, type TestUsers } from "./harness";

let h: Awaited<ReturnType<typeof setupIntegration>>;
let users: TestUsers;
let actions: typeof import("@/server/invoices/actions");
let queries: typeof import("@/server/invoices/queries");
let company: typeof import("@/server/company/actions");
let logoRoute: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
let customerId: string;

const PAPER_ITEMS = [
  { description: "COMFAST CF-E130N Wireless Bridge 300M 2.4GHz", quantity: "60", unit: "ตัว", unitPrice: "650.00", discount: "" },
  { description: "Xiaomi wifi router 4a AC1200", quantity: "36", unit: "ตัว", unitPrice: "1,169.00", discount: "" },
  { description: "Xiaomi wifi Router Pro 4 AC2600", quantity: "12", unit: "ตัว", unitPrice: "2,498.00", discount: "" },
];

function invoiceForm(overrides: Record<string, string> = {}, items: unknown = PAPER_ITEMS) {
  const fd = new FormData();
  const values = {
    customerId,
    buyerName: "บริษัท ผู้ซื้อทดสอบ จำกัด",
    buyerBranch: "สำนักงานใหญ่",
    buyerAddress: "1 ถนนทดสอบ กรุงเทพฯ 10100",
    buyerTaxId: "0-1055-36009-60-4",
    issueDate: "2026-09-17",
    dueDate: "2026-09-17",
    salesperson: "ทดสอบ",
    paymentTerm: "เงินสด",
    remark: "",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  fd.set("items", JSON.stringify(items));
  // A tampered client total must have no effect
  fd.set("total", "1.00");
  return fd;
}

function companyForm(overrides: Record<string, string> = {}, logo?: File) {
  const fd = new FormData();
  const values = {
    nameTh: "บริษัท ผู้ขายทดสอบ จำกัด",
    nameEn: "TEST SELLER CO., LTD.",
    addressTh: "99 หมู่ 1 ตำบลทดสอบ",
    addressEn: "",
    phone: "02-000-0000",
    email: "",
    lineId: "",
    facebook: "",
    taxId: "0105536009604",
    branchType: "head",
    branchCode: "",
    headerNote: "เอกสารออกเป็นชุด",
    invoicePrefix: "TS",
    vatRate: "7",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  if (logo) fd.set("logo", logo);
  return fd;
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

async function createAs(user: { id: string }, overrides: Record<string, string> = {}) {
  h.loginAs(user);
  const url = await expectRedirect(actions.createInvoice({}, invoiceForm(overrides)));
  return url.split("/").pop()!;
}

before(async () => {
  h = await setupIntegration();
  users = h.users;
  actions = await import("@/server/invoices/actions");
  queries = await import("@/server/invoices/queries");
  company = await import("@/server/company/actions");
  logoRoute = (await import("@/app/api/company/logo/route")).GET;
  const c = await h.db.customer.create({ data: { code: "C00001", name: "ผู้ซื้อทดสอบ", createdById: users.tier3.id } });
  customerId = c.id;
});

after(() => h.cleanup());

describe("company settings", () => {
  test("invoices can't be issued before the seller is set up", async () => {
    h.loginAs(users.tier1);
    const r = await actions.createInvoice({}, invoiceForm());
    assert.match(r.errors?.form ?? "", /ตั้งค่าข้อมูลบริษัท/);
    assert.equal(await h.db.invoice.count(), 0);
  });

  test("only admins can change them", async () => {
    for (const u of [users.tier1, users.tier2, users.tier3]) {
      h.loginAs(u);
      await assert.rejects(company.saveCompany({}, companyForm()), ForbiddenError);
    }
    assert.equal(await h.db.companySettings.count(), 0);
  });

  test("validates tax ID, prefix, VAT rate and logo type", async () => {
    h.loginAs(users.admin);
    const r = await company.saveCompany({}, companyForm({ taxId: "1234567890123", invoicePrefix: "TS/1", vatRate: "abc" }, new File(["not an image"], "logo.png")));
    assert.ok(r.errors?.taxId);
    assert.ok(r.errors?.invoicePrefix);
    assert.ok(r.errors?.vatRate);
    assert.match(r.errors?.logo ?? "", /PNG, JPG หรือ WebP/);
    assert.equal(await h.db.companySettings.count(), 0);
  });

  test("saves, stores the logo and serves it", async () => {
    h.loginAs(users.admin);
    const r = await company.saveCompany({}, companyForm({}, new File([PNG], "logo.png")));
    assert.deepEqual(r, { saved: true });
    const row = await h.db.companySettings.findUniqueOrThrow({ where: { id: 1 } });
    assert.equal(row.taxId, "0105536009604");
    assert.equal(row.logoMime, "image/png");

    h.loginAs(users.tier1);
    const res = await logoRoute(new NextRequest("http://localhost/api/company/logo"), { params: Promise.resolve({}) });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PNG);

    h.loginAs(null);
    assert.equal((await logoRoute(new NextRequest("http://localhost/api/company/logo"), { params: Promise.resolve({}) })).status, 401);
  });
});

describe("issuing", () => {
  let firstId: string;

  test("tier 1 issues an invoice; totals are computed on the server", async () => {
    firstId = await createAs(users.tier1);
    const inv = await queries.getInvoice(users.tier1, firstId);
    assert.ok(inv);
    assert.equal(inv.number, "TS-092026/00001");
    assert.equal(inv.subtotal, "111060.00");
    assert.equal(inv.vatRate, "7");
    assert.equal(inv.vatAmount, "7774.20");
    assert.equal(inv.total, "118834.20");
    assert.deepEqual(inv.items.map((i) => i.amount), ["39000.00", "42084.00", "29976.00"]);
    assert.equal(inv.buyerTaxId, "0105536009604");
    assert.equal(inv.seller.nameTh, "บริษัท ผู้ขายทดสอบ จำกัด");
    assert.equal(inv.status, "ISSUED");
  });

  test("blank item rows are ignored; bad input is reported per field and row", async () => {
    h.loginAs(users.tier1);
    const blank = { description: "", quantity: "", unit: "", unitPrice: "", discount: "" };
    const ok = await expectRedirect(actions.createInvoice({}, invoiceForm({}, [blank, PAPER_ITEMS[0], blank])));
    const inv = await queries.getInvoice(users.tier1, ok.split("/").pop()!);
    assert.equal(inv?.items.length, 1);

    const r = await actions.createInvoice(
      {},
      invoiceForm({ buyerTaxId: "1111111111111", dueDate: "2026-09-01" }, [{ description: "x", quantity: "1", unit: "", unitPrice: "10", discount: "20" }]),
    );
    assert.ok(r.errors?.buyerTaxId);
    assert.ok(r.errors?.dueDate);
    assert.match(r.errors?.["items.0.discount"] ?? "", /ส่วนลดมากกว่า/);

    const none = await actions.createInvoice({}, invoiceForm({}, []));
    assert.ok(none.errors?.items);
  });

  test("numbers are consecutive and unique, even for simultaneous submits", async () => {
    h.loginAs(users.tier2);
    const before = await h.db.invoice.count();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => actions.createInvoice({}, invoiceForm())));
    assert.ok(results.every((r) => r.status === "rejected" && /redirect/.test(String(r.reason))), "all five succeed");
    const seqs = (await h.db.invoice.findMany({ orderBy: { seq: "asc" }, select: { seq: true } })).map((r) => r.seq);
    assert.deepEqual(seqs, Array.from({ length: before + 5 }, (_, i) => i + 1));
  });

  test("issued invoices keep the buyer and seller as they were", async () => {
    await h.db.customer.update({ where: { id: customerId }, data: { name: "ชื่อใหม่" } });
    h.loginAs(users.admin);
    await company.saveCompany({}, companyForm({ nameTh: "บริษัท เปลี่ยนชื่อ จำกัด", vatRate: "10" }));
    const inv = await queries.getInvoice(users.admin, firstId);
    assert.equal(inv?.buyerName, "บริษัท ผู้ซื้อทดสอบ จำกัด");
    assert.equal(inv?.seller.nameTh, "บริษัท ผู้ขายทดสอบ จำกัด");
    assert.equal(inv?.vatRate, "7");
  });

  test("tier 1 sees only their own invoices; tier 2 sees all", async () => {
    const mine = await queries.listInvoices(users.tier1, {});
    assert.ok(mine.invoices.length >= 2);
    const tier2Invoice = await h.db.invoice.findFirstOrThrow({ where: { createdById: users.tier2.id } });
    assert.equal(await queries.getInvoice(users.tier1, tier2Invoice.id), null);
    const all = await queries.listInvoices(users.tier2, {});
    assert.equal(all.total, await h.db.invoice.count());
  });
});

describe("editing and cancelling: admins only", () => {
  let id: string;
  before(async () => {
    id = (await h.db.invoice.findFirstOrThrow({ where: { seq: 1 } })).id;
  });

  test("non-admins (and admin on tier 1) are forbidden", async () => {
    for (const u of [users.tier1, users.tier2, users.tier3, users.adminTier1]) {
      h.loginAs(u);
      await assert.rejects(actions.updateInvoice(id, {}, invoiceForm({ buyerName: "แก้" })), ForbiddenError, u.username);
      await assert.rejects(actions.cancelInvoice(id), ForbiddenError, u.username);
    }
    const row = await h.db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(row.buyerName, "บริษัท ผู้ซื้อทดสอบ จำกัด");
    assert.equal(row.status, "ISSUED");
  });

  test("admin edits details and items; totals recomputed with the original VAT rate, number unchanged", async () => {
    h.loginAs(users.admin);
    const url = await expectRedirect(
      actions.updateInvoice(id, {}, invoiceForm({ buyerName: "ชื่อที่แก้แล้ว", remark: "แก้ไขรายการ" }, [{ description: "สินค้าใหม่", quantity: "2", unit: "ชิ้น", unitPrice: "1000", discount: "100" }])),
    );
    assert.equal(url, `/invoices/${id}`);
    const inv = await queries.getInvoice(users.admin, id);
    assert.equal(inv?.number, "TS-092026/00001");
    assert.equal(inv?.buyerName, "ชื่อที่แก้แล้ว");
    assert.equal(inv?.items.length, 1);
    assert.equal(inv?.subtotal, "1900.00");
    assert.equal(inv?.vatRate, "7", "company VAT was changed to 10 but this invoice keeps 7");
    assert.equal(inv?.vatAmount, "133.00");
    assert.equal(inv?.total, "2033.00");
    assert.equal(inv?.updatedById, users.admin.id);
  });

  test("admin cancels; a cancelled invoice can't be edited and keeps its number", async () => {
    h.loginAs(users.admin);
    await actions.cancelInvoice(id);
    const row = await h.db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, "CANCELLED");
    assert.ok(row.cancelledAt);
    const r = await actions.updateInvoice(id, {}, invoiceForm());
    assert.match(r.errors?.form ?? "", /ยกเลิกแล้ว/);

    // The next invoice does not reuse the cancelled number
    const maxBefore = (await h.db.invoice.aggregate({ _max: { seq: true } }))._max.seq!;
    const next = await createAs(users.admin);
    assert.equal((await h.db.invoice.findUniqueOrThrow({ where: { id: next } })).seq, maxBefore + 1);
  });
});
