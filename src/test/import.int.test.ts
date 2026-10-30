// Excel import end to end: upload → analyze → commit, through the real server
// actions and a real database. Pure parsing/classification is covered in
// src/server/import/import.test.ts.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { guessMapping, importFieldsFor } from "@/lib/import-fields";
import { RedirectError, expectRedirect, setupIntegration, type TestUsers } from "./harness";

let h: Awaited<ReturnType<typeof setupIntegration>>;
let users: TestUsers;
let actions: typeof import("@/server/import/actions");
let fileRoute: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
let existingId: string;

const HEADERS = ["ชื่อลูกค้า", "เบอร์โทร", "เลขประจำตัวผู้เสียภาษี", "รหัสสาขา", "วงเงินเครดิต", "อีเมล"];
const ROWS = [
  ["ร้านใหม่ หนึ่ง", "0899999999", "", "", "15000", "new@example.com"], // new
  ["สยามเทรดดิ้ง (ชื่อใหม่)", "", "0105536009604", "00000", "80000", ""], // duplicate by tax ID
  ["", "0811111111", "", "", "", ""], // invalid: no name
  ["อีเมลผิด", "", "", "", "", "not-an-email"], // invalid: bad email
];

function xlsxFile(rows: string[][] = ROWS, name = "ลูกค้า.xlsx") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new File([new Uint8Array(buf)], name);
}

function form(file: File) {
  const fd = new FormData();
  fd.set("file", file);
  return fd;
}

/** Uploads and returns the new batch id */
async function upload(file = xlsxFile()) {
  const url = await expectRedirect(actions.uploadImportFile({}, form(file)));
  const m = url.match(/^\/import\/(\w+)$/);
  assert.ok(m, `unexpected redirect ${url}`);
  return m[1];
}

/** What the import page would send: the auto-detected column mapping */
function autoMapping(canEditFinancial: boolean) {
  return Object.fromEntries(Object.entries(guessMapping(HEADERS, importFieldsFor({ canEditFinancial }))).map(([k, v]) => [k, v]));
}
const FULL_MAPPING = { 0: "name", 1: "phone", 2: "taxId", 3: "branch", 4: "creditLimit", 5: "email" };

before(async () => {
  h = await setupIntegration();
  users = h.users;
  actions = await import("@/server/import/actions");
  fileRoute = (await import("@/app/api/import/[id]/file/route")).GET;
});

after(() => h.cleanup());

// Each test starts from one existing customer that row 2 duplicates
beforeEach(async () => {
  await h.db.auditLog.deleteMany();
  await h.db.importLog.deleteMany();
  await h.db.customer.deleteMany();
  const c = await h.db.customer.create({
    data: {
      code: "C00001",
      name: "สยามเทรดดิ้ง",
      phone: "02-123-4567",
      phoneNormalized: "021234567",
      taxId: "0105536009604",
      branchCode: "00000",
      creditLimit: "1000",
      createdById: users.tier3.id,
    },
  });
  existingId = c.id;
});

describe("upload", () => {
  before(() => h.loginAs(users.tier2));

  test("stores the staged rows and the original file", async () => {
    const file = xlsxFile();
    const id = await upload(file);
    const log = await h.db.importLog.findUniqueOrThrow({ where: { id } });
    assert.equal(log.status, "PREVIEW");
    assert.equal(log.userId, users.tier2.id);
    assert.equal(log.fileName, "ลูกค้า.xlsx");
    assert.equal(log.totalRows, 4);
    assert.deepEqual(JSON.parse(log.headers), HEADERS);
    assert.ok(log.fileStored);

    // The owner can download exactly what was uploaded
    const res = await fileRoute(new NextRequest(`http://localhost/api/import/${id}/file`), { params: Promise.resolve({ id }) });
    assert.equal(res.status, 200);
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), new Uint8Array(await file.arrayBuffer()));
  });

  test("rejects missing, empty and unsupported files without creating a log", async () => {
    assert.deepEqual(await actions.uploadImportFile({}, new FormData()), { error: "กรุณาเลือกไฟล์" });
    assert.deepEqual(await actions.uploadImportFile({}, form(new File([], "a.xlsx"))), { error: "กรุณาเลือกไฟล์" });
    const r = await actions.uploadImportFile({}, form(new File(["x"], "a.txt")));
    assert.match(r.error ?? "", /รองรับเฉพาะ/);
    assert.equal(await h.db.importLog.count(), 0);
  });

  test("logged out → /login", async () => {
    h.loginAs(null);
    assert.equal(await expectRedirect(actions.uploadImportFile({}, form(xlsxFile()))), "/login");
    h.loginAs(users.tier2);
  });
});

describe("tier 2: analyze and commit", () => {
  before(() => h.loginAs(users.tier2));

  test("analyze classifies new / duplicate / invalid rows", async () => {
    const id = await upload();
    const result = await actions.analyzeImport(id, autoMapping(true));
    assert.ok("rows" in result, JSON.stringify(result));
    assert.deepEqual(
      result.rows.map((r) => [r.rowNumber, r.status]),
      [
        [2, "new"],
        [3, "duplicate"],
        [4, "invalid"],
        [5, "invalid"],
      ],
    );
    assert.deepEqual(result.rows[1].match, { code: "C00001", name: "สยามเทรดดิ้ง", by: "taxId" });
    // Nothing is written until commit
    assert.equal(await h.db.customer.count(), 1);
  });

  test("commit creates, updates, records errors, and writes audit history", async () => {
    const id = await upload();
    const url = await expectRedirect(actions.commitImport(id, autoMapping(true), { duplicateDefault: "update", overrides: {} }));
    assert.equal(url, `/import/${id}`);

    const created = await h.db.customer.findFirstOrThrow({ where: { name: "ร้านใหม่ หนึ่ง" } });
    assert.equal(created.code, "C00002");
    assert.equal(created.creditLimit?.toFixed(2), "15000.00");
    assert.equal(created.phoneNormalized, "0899999999");
    assert.equal(created.createdById, users.tier2.id);

    const updated = await h.db.customer.findUniqueOrThrow({ where: { id: existingId } });
    assert.equal(updated.name, "สยามเทรดดิ้ง (ชื่อใหม่)");
    assert.equal(updated.creditLimit?.toFixed(2), "80000.00");
    assert.equal(updated.phone, "02-123-4567", "blank cells must not wipe existing data");

    const log = await h.db.importLog.findUniqueOrThrow({ where: { id }, include: { errors: true } });
    assert.equal(log.status, "COMPLETED");
    assert.deepEqual(
      [log.createdRows, log.updatedRows, log.skippedRows, log.failedRows],
      [1, 1, 0, 2],
    );
    assert.equal(log.rows, "[]", "staged rows are cleared after commit");
    assert.deepEqual(log.errors.map((e) => e.rowNumber).sort(), [4, 5]);

    const audit = await h.db.auditLog.findMany({ where: { importLogId: id }, orderBy: { action: "asc" } });
    assert.deepEqual(audit.map((a) => a.action), ["CREATE", "UPDATE"]);
    assert.ok(audit.every((a) => a.userId === users.tier2.id));
  });

  test("duplicates are skipped by default, per-row override can update", async () => {
    const id = await upload();
    await expectRedirect(actions.commitImport(id, autoMapping(true), { duplicateDefault: "skip", overrides: {} }));
    assert.equal((await h.db.customer.findUniqueOrThrow({ where: { id: existingId } })).name, "สยามเทรดดิ้ง");
    const log = await h.db.importLog.findUniqueOrThrow({ where: { id } });
    assert.deepEqual([log.createdRows, log.updatedRows, log.skippedRows], [1, 0, 1]);

    const id2 = await upload(xlsxFile([ROWS[1]]));
    await expectRedirect(actions.commitImport(id2, autoMapping(true), { duplicateDefault: "skip", overrides: { 0: "update" } }));
    assert.equal((await h.db.customer.findUniqueOrThrow({ where: { id: existingId } })).name, "สยามเทรดดิ้ง (ชื่อใหม่)");
  });

  test("the same batch can't be imported twice, even with simultaneous submits", async () => {
    const id = await upload();
    const decisions = { duplicateDefault: "skip", overrides: {} };
    const results = await Promise.allSettled([
      actions.commitImport(id, autoMapping(true), decisions),
      actions.commitImport(id, autoMapping(true), decisions),
    ]);
    // Success = redirect to the result page; the loser returns an error instead
    const succeeded = results.filter((r) => r.status === "rejected" && r.reason instanceof RedirectError);
    const refused = results.filter((r) => r.status === "fulfilled" && /นำเข้าไปแล้ว/.test(r.value.error));
    assert.equal(succeeded.length, 1, "exactly one commit succeeds");
    assert.equal(refused.length, 1, "the other is refused");
    assert.equal(await h.db.customer.count({ where: { name: "ร้านใหม่ หนึ่ง" } }), 1);

    const again = await actions.commitImport(id, autoMapping(true), decisions);
    assert.match(again.error, /นำเข้าไปแล้ว/);
  });

  test("mapping must include the name column", async () => {
    const id = await upload();
    const r = await actions.analyzeImport(id, { 1: "phone" });
    assert.ok("error" in r && /ชื่อลูกค้า/.test(r.error));
  });

  test("cancel clears staged rows and blocks commit", async () => {
    const id = await upload();
    assert.equal(await expectRedirect(actions.cancelImport(id)), "/import");
    const log = await h.db.importLog.findUniqueOrThrow({ where: { id } });
    assert.equal(log.status, "CANCELLED");
    assert.equal(log.rows, "[]");
    const r = await actions.commitImport(id, autoMapping(true), { duplicateDefault: "skip", overrides: {} });
    assert.match(r.error, /ไม่พบ/);
    assert.equal(await h.db.customer.count(), 1);
  });
});

describe("tier 1: financial columns are never imported", () => {
  before(() => h.loginAs(users.tier1));

  test("auto mapping leaves the financial column unmapped", () => {
    assert.ok(!Object.values(autoMapping(false)).includes("creditLimit"));
  });

  test("a crafted mapping that includes creditLimit is ignored on the server", async () => {
    const id = await upload();
    await expectRedirect(actions.commitImport(id, FULL_MAPPING, { duplicateDefault: "update", overrides: {} }));

    const created = await h.db.customer.findFirstOrThrow({ where: { name: "ร้านใหม่ หนึ่ง" } });
    assert.equal(created.creditLimit, null);
    const updated = await h.db.customer.findUniqueOrThrow({ where: { id: existingId } });
    assert.equal(updated.name, "สยามเทรดดิ้ง (ชื่อใหม่)", "non-financial fields still update");
    assert.equal(updated.creditLimit?.toFixed(2), "1000.00", "financial value untouched");

    const log = await h.db.importLog.findUniqueOrThrow({ where: { id } });
    assert.ok(!Object.values(JSON.parse(log.columnMapping ?? "{}")).includes("creditLimit"));
  });
});

describe("batches belong to their uploader", () => {
  test("another user can't analyze, commit or cancel someone else's batch", async () => {
    h.loginAs(users.tier2);
    const id = await upload();

    h.loginAs(users.tier3);
    const analyzed = await actions.analyzeImport(id, autoMapping(true));
    assert.ok("error" in analyzed);
    const committed = await actions.commitImport(id, autoMapping(true), { duplicateDefault: "update", overrides: {} });
    assert.match(committed.error, /ไม่พบ/);
    await expectRedirect(actions.cancelImport(id));

    const log = await h.db.importLog.findUniqueOrThrow({ where: { id } });
    assert.equal(log.status, "PREVIEW");
    assert.equal(await h.db.customer.count(), 1);
  });
});
