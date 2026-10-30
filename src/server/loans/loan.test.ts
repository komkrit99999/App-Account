import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_INTEREST_RATE_PER_YEAR, isInterestDueOn, monthlyInterest } from "@/lib/loan";
import { parseLoanForm } from "./schema";

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = { customerId: "c1", principal: "5,000", interestRatePerYear: "15", interestDueDay: "30", startDate: "2026-10-01", principalDueDate: "", note: "", ...overrides };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

test("legal cap is 15% per year", () => {
  assert.equal(MAX_INTEREST_RATE_PER_YEAR, 15);
});

test("accepts rates up to the legal cap", () => {
  for (const rate of ["0", "7.5", "15", "15.00"]) {
    const r = parseLoanForm(form({ interestRatePerYear: rate }));
    assert.ok(r.ok, `rate ${rate}`);
  }
  const r = parseLoanForm(form());
  assert.ok(r.ok);
  assert.equal(r.data.principal, "5000");
  assert.equal(r.data.interestDueDay, 30);
  assert.equal(r.data.startDate.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(r.data.principalDueDate, null);
});

test("rejects rates above the legal cap, including 20% a month written as 240", () => {
  for (const rate of ["15.01", "20", "36", "240"]) {
    const r = parseLoanForm(form({ interestRatePerYear: rate }));
    assert.ok(!r.ok, `rate ${rate} must be rejected`);
    assert.match(r.errors.interestRatePerYear ?? "", /ไม่เกินร้อยละ 15/);
  }
});

test("rejects negative/garbage numbers, bad due days and dates", () => {
  const cases: [Record<string, string>, string][] = [
    [{ interestRatePerYear: "-1" }, "interestRatePerYear"],
    [{ interestRatePerYear: "abc" }, "interestRatePerYear"],
    [{ interestRatePerYear: "" }, "interestRatePerYear"],
    [{ principal: "0" }, "principal"],
    [{ principal: "-500" }, "principal"],
    [{ interestDueDay: "0" }, "interestDueDay"],
    [{ interestDueDay: "32" }, "interestDueDay"],
    [{ startDate: "" }, "startDate"],
    [{ startDate: "30/9/67" }, "startDate"],
    [{ principalDueDate: "2026-09-01" }, "principalDueDate"],
    [{ customerId: "" }, "customerId"],
  ];
  for (const [overrides, field] of cases) {
    const r = parseLoanForm(form(overrides));
    assert.ok(!r.ok && r.errors[field], `${JSON.stringify(overrides)} → error on ${field}`);
  }
});

test("monthlyInterest is simple interest per month, rounded to satang", () => {
  assert.equal(monthlyInterest("5000", "15"), 62.5);
  assert.equal(monthlyInterest("20000", "15"), 250);
  assert.equal(monthlyInterest("1000", "7"), 5.83);
  assert.equal(monthlyInterest("1000", "0"), 0);
});

test("isInterestDueOn falls back to the last day of short months", () => {
  assert.ok(isInterestDueOn(30, new Date(2026, 1, 28))); // Feb 2026 has 28 days
  assert.ok(isInterestDueOn(31, new Date(2026, 3, 30))); // April has 30
  assert.ok(!isInterestDueOn(30, new Date(2026, 3, 29)));
  assert.ok(isInterestDueOn(5, new Date(2026, 3, 5)));
});
