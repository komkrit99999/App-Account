import { test } from "node:test";
import assert from "node:assert/strict";
import { bahtText, computeTotals, formatInvoiceNumber, toHundredths } from "./invoice";

test("totals match the paper invoice (VAT 7% added on top)", () => {
  const t = computeTotals(
    [
      { quantity: "60", unitPrice: "650.00", discount: "" },
      { quantity: "36", unitPrice: "1,169.00", discount: "" },
      { quantity: "12", unitPrice: "2,498.00", discount: "" },
    ],
    "7",
  );
  assert.deepEqual(t, {
    amounts: ["39000.00", "42084.00", "29976.00"],
    subtotal: "111060.00",
    vatAmount: "7774.20",
    total: "118834.20",
  });
});

test("discounts, fractional quantities and half-up rounding", () => {
  const t = computeTotals([{ quantity: "1.5", unitPrice: "33.33", discount: "10" }], "7");
  // 1.5 × 33.33 = 49.995 → 50.00, − 10 = 40.00; VAT 2.80
  assert.deepEqual(t, { amounts: ["40.00"], subtotal: "40.00", vatAmount: "2.80", total: "42.80" });
  assert.equal(computeTotals([{ quantity: "1", unitPrice: "0.07", discount: "" }], "7")?.vatAmount, "0.00"); // 0.0049 → 0
  assert.equal(computeTotals([{ quantity: "1", unitPrice: "0.08", discount: "" }], "7")?.vatAmount, "0.01"); // 0.0056 → 0.01
  assert.equal(computeTotals([{ quantity: "1", unitPrice: "100", discount: "" }], "0")?.total, "100.00");
});

test("invalid input or a discount larger than the line gives null", () => {
  assert.equal(computeTotals([{ quantity: "abc", unitPrice: "1", discount: "" }], "7"), null);
  assert.equal(computeTotals([{ quantity: "-1", unitPrice: "1", discount: "" }], "7"), null);
  assert.equal(computeTotals([{ quantity: "1", unitPrice: "1.234", discount: "" }], "7"), null);
  assert.equal(computeTotals([{ quantity: "1", unitPrice: "10", discount: "11" }], "7"), null);
  assert.equal(toHundredths("1,234.5"), 123450n);
});

test("bahtText", () => {
  const cases: [string, string][] = [
    ["118834.20", "หนึ่งแสนหนึ่งหมื่นแปดพันแปดร้อยสามสิบสี่บาทยี่สิบสตางค์"],
    ["0", "ศูนย์บาทถ้วน"],
    ["1", "หนึ่งบาทถ้วน"],
    ["11", "สิบเอ็ดบาทถ้วน"],
    ["21.21", "ยี่สิบเอ็ดบาทยี่สิบเอ็ดสตางค์"],
    ["101", "หนึ่งร้อยเอ็ดบาทถ้วน"],
    ["0.50", "ห้าสิบสตางค์"],
    ["1000000", "หนึ่งล้านบาทถ้วน"],
    ["1000001", "หนึ่งล้านเอ็ดบาทถ้วน"],
    ["21000000", "ยี่สิบเอ็ดล้านบาทถ้วน"],
    ["7774.20", "เจ็ดพันเจ็ดร้อยเจ็ดสิบสี่บาทยี่สิบสตางค์"],
  ];
  for (const [n, words] of cases) assert.equal(bahtText(n), words, n);
});

test("invoice number: prefix, MMYYYY of the issue date, 5-digit running number", () => {
  assert.equal(formatInvoiceNumber("ST", new Date("2026-09-17T00:00:00Z"), 70), "ST-092026/00070");
});
