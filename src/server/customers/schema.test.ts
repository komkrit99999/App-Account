import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCustomerForm } from "./schema";

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

const valid = {
  name: "บริษัท ทดสอบ จำกัด",
  phone: "081-234-5678",
  taxId: "0-1055-36009-60-4",
  branchType: "head",
  creditLimit: "50,000",
  paymentTermDays: "30",
  outstandingBalance: "1234.50",
};

test("parses a valid form and normalizes values", () => {
  const r = parseCustomerForm(form(valid), { canEditFinancial: true });
  assert.ok(r.ok);
  assert.equal(r.data.taxId, "0105536009604");
  assert.equal(r.data.phoneNormalized, "0812345678");
  assert.equal(r.data.branchCode, "00000");
  assert.equal(r.data.creditLimit, "50000");
  assert.equal(r.data.paymentTermDays, 30);
  assert.equal(r.data.outstandingBalance, "1234.50");
});

test("ignores financial fields when the user can't edit them", () => {
  const r = parseCustomerForm(form({ ...valid, creditLimit: "999999999" }), { canEditFinancial: false });
  assert.ok(r.ok);
  assert.equal("creditLimit" in r.data, false);
  assert.equal("paymentTermDays" in r.data, false);
  assert.equal("outstandingBalance" in r.data, false);
});

test("rejects bad tax IDs with a specific message", () => {
  const short = parseCustomerForm(form({ ...valid, taxId: "12345" }), { canEditFinancial: false });
  assert.ok(!short.ok);
  assert.equal(short.errors.taxId, "ต้องเป็นตัวเลข 13 หลัก");

  const checksum = parseCustomerForm(form({ ...valid, taxId: "0105536009601" }), { canEditFinancial: false });
  assert.ok(!checksum.ok);
  assert.match(checksum.errors.taxId!, /หลักสุดท้ายไม่ตรง/);
});

test("tax ID is optional", () => {
  const r = parseCustomerForm(form({ name: "คุณสมชาย", branchType: "head" }), { canEditFinancial: false });
  assert.ok(r.ok);
  assert.equal(r.data.taxId, null);
});

test("branch requires a 5-digit code other than 00000", () => {
  const missing = parseCustomerForm(form({ ...valid, branchType: "branch", branchCode: "" }), { canEditFinancial: false });
  assert.ok(!missing.ok);
  assert.ok(missing.errors.branchCode);

  const hq = parseCustomerForm(form({ ...valid, branchType: "branch", branchCode: "00000" }), { canEditFinancial: false });
  assert.ok(!hq.ok);

  const ok = parseCustomerForm(form({ ...valid, branchType: "branch", branchCode: "00012" }), { canEditFinancial: false });
  assert.ok(ok.ok);
  assert.equal(ok.data.isHeadOffice, false);
  assert.equal(ok.data.branchCode, "00012");
});

test("validates name, email and money", () => {
  const r = parseCustomerForm(
    form({ ...valid, name: " ", email: "not-an-email", creditLimit: "-5", paymentTermDays: "400" }),
    { canEditFinancial: true },
  );
  assert.ok(!r.ok);
  assert.ok(r.errors.name);
  assert.ok(r.errors.email);
  assert.ok(r.errors.creditLimit);
  assert.ok(r.errors.paymentTermDays);
});
