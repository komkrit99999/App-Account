import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SNAPSHOT, diffSnapshots, redactChanges, snapshotOf, type SnapshotSource } from "./diff";

const dec = (n: number) => ({ toFixed: (dp: number) => n.toFixed(dp) });

const base: SnapshotSource = {
  name: "ร้านเดิม",
  phone: "0812345678",
  email: null,
  address: null,
  note: "",
  companyName: null,
  taxId: "0105536009604",
  isHeadOffice: true,
  branchCode: "00000",
  contactPerson: null,
  creditLimit: dec(1000),
  paymentTermDays: 30,
  outstandingBalance: dec(0),
  tags: [{ tag: { name: "VIP" } }, { tag: { name: "ขายส่ง" } }],
};

test("snapshotOf formats branch, money and tags", () => {
  const s = snapshotOf(base);
  assert.equal(s.branch, "สำนักงานใหญ่");
  assert.equal(s.creditLimit, "1000.00");
  assert.equal(s.paymentTermDays, "30");
  assert.equal(s.tags, "ขายส่ง, VIP");
  assert.equal(snapshotOf({ ...base, isHeadOffice: false, branchCode: "00002" }).branch, "สาขา 00002");
});

test("diffSnapshots lists only changed fields, treating '' and null alike", () => {
  const after = snapshotOf({ ...base, name: "ร้านใหม่", note: null, creditLimit: dec(2500.5), tags: [{ tag: { name: "VIP" } }] });
  assert.deepEqual(diffSnapshots(snapshotOf(base), after), [
    { field: "name", from: "ร้านเดิม", to: "ร้านใหม่" },
    { field: "creditLimit", from: "1000.00", to: "2500.50" },
    { field: "tags", from: "ขายส่ง, VIP", to: "VIP" },
  ]);
  assert.deepEqual(diffSnapshots(snapshotOf(base), snapshotOf(base)), []);
});

test("create/delete diff against an empty snapshot", () => {
  const created = diffSnapshots(EMPTY_SNAPSHOT, snapshotOf(base));
  assert.ok(created.every((c) => c.from === null));
  assert.ok(created.some((c) => c.field === "taxId" && c.to === "0105536009604"));
  const deleted = diffSnapshots(snapshotOf(base), EMPTY_SNAPSHOT);
  assert.ok(deleted.every((c) => c.to === null));
});

test("redactChanges hides financial values only", () => {
  const changes = diffSnapshots(snapshotOf(base), snapshotOf({ ...base, name: "ใหม่", creditLimit: dec(5) }));
  assert.deepEqual(redactChanges(changes, false), [
    { field: "name", from: "ร้านเดิม", to: "ใหม่" },
    { field: "creditLimit", from: null, to: null, hidden: true },
  ]);
  assert.deepEqual(redactChanges(changes, true), changes);
});
