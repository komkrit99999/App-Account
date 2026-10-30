import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTaxId, isValidThaiTaxId } from "./thai-tax-id";
import { normalizePhone } from "./phone";

test("accepts IDs with a correct check digit", () => {
  assert.equal(isValidThaiTaxId("0105536009604"), true);
  assert.equal(isValidThaiTaxId("3100100123451"), true);
  assert.equal(isValidThaiTaxId("0-1055-36009-60-4"), true); // dashes allowed
  assert.equal(isValidThaiTaxId("0105 5360 09604"), true); // spaces allowed
});

test("rejects wrong check digit, length or characters", () => {
  assert.equal(isValidThaiTaxId("0105536009601"), false);
  assert.equal(isValidThaiTaxId("010553600960"), false);
  assert.equal(isValidThaiTaxId("01055360096011"), false);
  assert.equal(isValidThaiTaxId("010553600960A"), false);
  assert.equal(isValidThaiTaxId(""), false);
});

test("formats 13 digits for display", () => {
  assert.equal(formatTaxId("0105536009604"), "0-1055-36009-60-4");
  assert.equal(formatTaxId("123"), "123");
});

test("normalizes phone numbers", () => {
  assert.equal(normalizePhone("081-234-5678"), "0812345678");
  assert.equal(normalizePhone("+66 81 234 5678"), "0812345678");
  assert.equal(normalizePhone("02 123 4567"), "021234567");
});
