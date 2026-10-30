import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { guessMapping, importFieldsFor, type ColumnMapping } from "@/lib/import-fields";
import { classifyRows, parseBranch, updateDataFor, type ExistingCustomer } from "./classify";
import { parseSpreadsheet } from "./parse";

const ALL = importFieldsFor({ canEditFinancial: true });
const BASIC = importFieldsFor({ canEditFinancial: false });

test("importFieldsFor hides financial fields below tier 2", () => {
  assert.ok(ALL.includes("creditLimit"));
  assert.ok(!BASIC.includes("creditLimit"));
  assert.ok(!BASIC.includes("paymentTermDays"));
  assert.ok(!BASIC.includes("outstandingBalance"));
});

test("guessMapping recognises Thai and English headers", () => {
  const headers = ["ชื่อลูกค้า", "Phone", " เลขผู้เสียภาษี ", "ไม่รู้จัก", "วงเงินเครดิต", "E-mail"];
  assert.deepEqual(guessMapping(headers, ALL), { 0: "name", 1: "phone", 2: "taxId", 4: "creditLimit", 5: "email" });
  // Financial header is left unmapped for tier 1
  assert.deepEqual(guessMapping(headers, BASIC), { 0: "name", 1: "phone", 2: "taxId", 5: "email" });
});

test("parseBranch", () => {
  assert.deepEqual(parseBranch(""), { branchType: "head", branchCode: "" });
  assert.deepEqual(parseBranch("สำนักงานใหญ่"), { branchType: "head", branchCode: "" });
  assert.deepEqual(parseBranch("00000"), { branchType: "head", branchCode: "" });
  assert.deepEqual(parseBranch("1"), { branchType: "branch", branchCode: "00001" });
  assert.deepEqual(parseBranch("สาขา 00012"), { branchType: "branch", branchCode: "00012" });
});

const mapping: ColumnMapping = { 0: "name", 1: "phone", 2: "taxId", 3: "branch", 4: "creditLimit", 5: "email" };
const existing: ExistingCustomer[] = [
  { id: "c1", code: "C00001", name: "สยามเทรดดิ้ง", taxId: "0105536009604", branchCode: "00000", phoneNormalized: "021234567" },
  { id: "c2", code: "C00002", name: "ร้านสมชาย", taxId: null, branchCode: "00000", phoneNormalized: "0812345678" },
];

test("classifyRows: new, duplicate by tax ID / phone, invalid, in-file duplicate", () => {
  const rows = [
    ["ลูกค้าใหม่", "0899999999", "", "", "5000", ""], // new
    ["สยาม (ไฟล์)", "", "105536009604", "", "", ""], // tax ID lost its leading zero in Excel → still matches c1
    ["สยาม สาขา 1", "", "0105536009604", "1", "", ""], // same tax ID, different branch → new
    ["สมชาย", "812345678", "", "", "", ""], // numeric cell lost its leading zero → restored, matches c2
    ["", "", "123", "", "abc", "bad"], // invalid
    ["ซ้ำในไฟล์", "0899999999", "", "", "", ""], // same phone as row 2
  ];
  const r = classifyRows(rows, mapping, { canEditFinancial: true }, existing);

  assert.deepEqual(r.map((x) => x.status), ["new", "duplicate", "new", "duplicate", "invalid", "invalid"]);
  assert.deepEqual(r.map((x) => x.rowNumber), [2, 3, 4, 5, 6, 7]);

  assert.ok(r[1].status === "duplicate" && r[1].match.code === "C00001" && r[1].match.by === "taxId");
  assert.ok(r[3].status === "duplicate" && r[3].match.code === "C00002" && r[3].match.by === "phone");
  assert.ok(r[2].status === "new" && r[2].data.branchCode === "00001");

  assert.ok(r[4].status === "invalid");
  const errs = r[4].errors.join(" | ");
  assert.match(errs, /ชื่อลูกค้า:/);
  assert.match(errs, /เลขประจำตัวผู้เสียภาษี: ต้องเป็นตัวเลข 13 หลัก/);
  assert.match(errs, /อีเมล:/);
  assert.match(errs, /วงเงินเครดิต:/);

  assert.ok(r[5].status === "invalid");
  assert.match(r[5].errors[0], /แถวที่ 2/);
});

test("classifyRows ignores financial values for tier 1", () => {
  const r = classifyRows([["ก", "", "", "", "99999", ""]], mapping, { canEditFinancial: false }, []);
  assert.ok(r[0].status === "new");
  assert.equal(r[0].data.creditLimit, undefined);
});

test("updateDataFor only overwrites mapped, non-empty cells", () => {
  const r = classifyRows([["สยามใหม่", "", "0105536009604", "", "", "new@x.co"]], mapping, { canEditFinancial: true }, existing);
  assert.ok(r[0].status === "duplicate");
  const update = updateDataFor(r[0].data, r[0].provided);
  assert.deepEqual(Object.keys(update).sort(), ["email", "name", "taxId"]);
  assert.equal(update.email, "new@x.co");
});

test("parseSpreadsheet: xlsx keeps long numbers intact and drops blank rows", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["ชื่อลูกค้า", "เลขภาษี", "วงเงิน"],
    ["ก", 3100100123451, 1500.5],
    ["", "", ""],
    ["ข", "0105536009604", 0],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const sheet = parseSpreadsheet(buf, "x.xlsx");
  assert.ok(!("error" in sheet));
  assert.deepEqual(sheet.headers, ["ชื่อลูกค้า", "เลขภาษี", "วงเงิน"]);
  assert.deepEqual(sheet.rows, [
    ["ก", "3100100123451", "1500.5"],
    ["ข", "0105536009604", "0"],
  ]);
});

test("parseSpreadsheet: CSV in UTF-8 (with BOM) and Windows-874", () => {
  const text = "ชื่อลูกค้า,เบอร์โทร\nร้านค้า ก,0812345678\n";
  const utf8 = parseSpreadsheet(Buffer.from("﻿" + text, "utf8"), "a.csv");
  assert.ok(!("error" in utf8));
  assert.deepEqual(utf8.rows, [["ร้านค้า ก", "0812345678"]]);

  // Thai chars U+0E01–U+0E5B map to 0xA1–0xFB in Windows-874
  const tis = Buffer.from([...text].map((ch) => {
    const c = ch.codePointAt(0)!;
    return c >= 0x0e01 && c <= 0x0e5b ? c - 0x0e01 + 0xa1 : c;
  }));
  const legacy = parseSpreadsheet(tis, "b.csv");
  assert.ok(!("error" in legacy));
  assert.deepEqual(legacy.headers, ["ชื่อลูกค้า", "เบอร์โทร"]);
  assert.deepEqual(legacy.rows, [["ร้านค้า ก", "0812345678"]]);
});

test("parseSpreadsheet: errors", () => {
  assert.ok("error" in parseSpreadsheet(Buffer.from("ชื่อ\n", "utf8"), "a.csv"));
  assert.ok("error" in parseSpreadsheet(Buffer.from("not a spreadsheet \x00\x01\x02"), "a.xlsx"));
});
