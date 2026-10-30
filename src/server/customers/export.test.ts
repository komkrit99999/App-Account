import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildCustomerWorkbook } from "./export";
import type { CustomerDTO } from "./queries";

const customer: CustomerDTO = {
  id: "c1",
  code: "C00001",
  name: "ร้านสมชาย",
  phone: "0812345678",
  email: null,
  address: null,
  note: null,
  facebook: "Somchai Jaidee",
  lineId: "somchai.j",
  workplace: null,
  workplacePhone: "02-035-1400 ต่อ 409",
  companyName: null,
  taxId: "0105536009604",
  isHeadOffice: true,
  branchCode: "00000",
  contactPerson: null,
  createdAt: new Date("2026-10-01T03:00:00Z"),
  updatedAt: new Date("2026-10-02T03:00:00Z"),
  createdBy: "แอดมิน",
  updatedBy: null,
  tags: [{ id: "t1", name: "VIP", color: "amber" }],
  financial: { creditLimit: "50000.00", paymentTermDays: 30, outstandingBalance: "1200.50" },
};

const meta = { exportedBy: "แอดมิน", exportedAt: new Date(), q: "", tagNames: [], total: 1 };

function readSheet(buf: Buffer) {
  const wb = XLSX.read(buf);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["ลูกค้า"]);
}

test("includes financial columns as numbers when allowed", () => {
  const [row] = readSheet(buildCustomerWorkbook([customer], { includeFinancial: true, meta }));
  assert.equal(row["วงเงินเครดิต"], 50000);
  assert.equal(row["เงื่อนไขชำระเงิน (วัน)"], 30);
  assert.equal(row["ยอดค้างชำระ"], 1200.5);
});

test("drops financial columns entirely when not allowed, even if data is present", () => {
  const buf = buildCustomerWorkbook([customer], { includeFinancial: false, meta });
  const [row] = readSheet(buf);
  for (const label of ["วงเงินเครดิต", "เงื่อนไขชำระเงิน (วัน)", "ยอดค้างชำระ"]) assert.ok(!(label in row), label);
  assert.ok(!/50000|1200/.test(JSON.stringify(XLSX.utils.sheet_to_json(XLSX.read(buf).Sheets["ลูกค้า"], { header: 1 }))));
});

test("keeps leading zeros in phone, tax ID and branch", () => {
  const [row] = readSheet(buildCustomerWorkbook([customer], { includeFinancial: false, meta }));
  assert.equal(row["เบอร์โทร"], "0812345678");
  assert.equal(row["เลขประจำตัวผู้เสียภาษี"], "0105536009604");
  assert.equal(row["รหัสสาขา"], "00000");
  assert.equal(row["แท็ก"], "VIP");
  assert.equal(row["Facebook"], "Somchai Jaidee");
  assert.equal(row["เบอร์ที่ทำงาน"], "02-035-1400 ต่อ 409");
});
