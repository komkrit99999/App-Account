// Tax invoice arithmetic and wording. Client-safe; used by the live preview in
// the form and recomputed on the server, which is the only source of truth.
// Money is handled as integer satang (BigInt) so totals never drift.

const SCALED = /^\d{1,12}(\.\d{1,2})?$/;

/** "1,169.5" → 116950n (hundredths). null if not a valid non-negative number. */
export function toHundredths(raw: string): bigint | null {
  const v = raw.trim().replace(/,/g, "");
  if (!SCALED.test(v)) return null;
  const [int, frac = ""] = v.split(".");
  return BigInt(int) * 100n + BigInt(frac.padEnd(2, "0"));
}

/** 116950n → "1169.50" */
export function fromHundredths(n: bigint): string {
  const sign = n < 0n ? "-" : "";
  const abs = n < 0n ? -n : n;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

/** a × b / 100, both in hundredths, rounded half up (non-negative inputs) */
function mulHundredths(a: bigint, b: bigint): bigint {
  return (a * b + 50n) / 100n;
}

export type ItemInput = { quantity: string; unitPrice: string; discount: string };

/** Line amount in satang = quantity × unit price − discount */
export function lineAmount(item: ItemInput): bigint | null {
  const q = toHundredths(item.quantity);
  const p = toHundredths(item.unitPrice);
  const d = item.discount.trim() === "" ? 0n : toHundredths(item.discount);
  if (q === null || p === null || d === null) return null;
  return mulHundredths(q, p) - d;
}

export type Totals = { amounts: string[]; subtotal: string; vatAmount: string; total: string };

/** VAT is added on top of the subtotal (prices exclude VAT), as on the paper form */
export function computeTotals(items: ItemInput[], vatRatePercent: string): Totals | null {
  const rate = toHundredths(vatRatePercent);
  if (rate === null) return null;
  const amounts: bigint[] = [];
  for (const item of items) {
    const a = lineAmount(item);
    if (a === null || a < 0n) return null;
    amounts.push(a);
  }
  const subtotal = amounts.reduce((s, a) => s + a, 0n);
  // subtotal (satang) × rate (hundredths of a percent) / 10000
  const vat = (subtotal * rate + 5000n) / 10000n;
  return {
    amounts: amounts.map(fromHundredths),
    subtotal: fromHundredths(subtotal),
    vatAmount: fromHundredths(vat),
    total: fromHundredths(subtotal + vat),
  };
}

// ---------- amount in Thai words ----------

const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Reads 0–999999. `afterHigher`: a higher group (ล้าน) precedes, so a trailing 1 is เอ็ด. */
function readGroup(n: number, afterHigher: boolean): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const place = s.length - 1 - i;
    if (d === 0) continue;
    if (place === 1) out += d === 1 ? "สิบ" : d === 2 ? "ยี่สิบ" : `${DIGITS[d]}สิบ`;
    else if (place === 0) out += d === 1 && (n > 9 || afterHigher) ? "เอ็ด" : DIGITS[d];
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
}

function readNumber(n: bigint): string {
  if (n < 1_000_000n) return readGroup(Number(n), false);
  const high = n / 1_000_000n;
  const low = Number(n % 1_000_000n);
  return `${readNumber(high)}ล้าน${low ? readGroup(low, true) : ""}`;
}

/** "118834.20" → "หนึ่งแสนหนึ่งหมื่นแปดพันแปดร้อยสามสิบสี่บาทยี่สิบสตางค์" */
export function bahtText(amount: string): string {
  const satang = toHundredths(amount);
  if (satang === null) return "";
  const baht = satang / 100n;
  const st = satang % 100n;
  if (baht === 0n && st === 0n) return "ศูนย์บาทถ้วน";
  const bahtPart = baht > 0n ? `${readNumber(baht)}บาท` : "";
  return st === 0n ? `${bahtPart}ถ้วน` : `${bahtPart}${readGroup(Number(st), false)}สตางค์`;
}
