// Pure row classification — no DB access, so it is unit-tested directly.
import { IMPORT_FIELDS, type ColumnMapping, type ImportField } from "@/lib/import-fields";
import { parseCustomerInput, type CustomerData } from "@/server/customers/schema";

export type ExistingCustomer = {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  branchCode: string | null;
  phoneNormalized: string | null;
};

export type RowMatch = { id: string; code: string; name: string; by: "taxId" | "phone" };

export type ClassifiedRow = {
  index: number;
  /** Row number as seen in Excel (header is row 1) */
  rowNumber: number;
  name: string;
  taxId: string | null;
  phone: string | null;
} & (
  | { status: "new"; data: CustomerData; provided: ImportField[] }
  | { status: "duplicate"; data: CustomerData; provided: ImportField[]; match: RowMatch }
  | { status: "invalid"; errors: string[] }
);

const ERROR_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(IMPORT_FIELDS).map(([k, v]) => [k, v.label])),
  branchCode: IMPORT_FIELDS.branch.label,
};

/** "สำนักงานใหญ่" / "" / "0" → head office; "1" / "สาขา 00012" → 5-digit branch */
export function parseBranch(raw: string): { branchType: "head" | "branch"; branchCode: string } {
  const v = raw.trim();
  if (v === "" || /^(สำนักงานใหญ่|สนญ\.?|head\s*office|hq)$/i.test(v)) return { branchType: "head", branchCode: "" };
  const digits = v.replace(/\D/g, "");
  if (digits === "") return { branchType: "branch", branchCode: v }; // fails validation with a clear message
  if (/^0+$/.test(digits)) return { branchType: "head", branchCode: "" };
  return { branchType: "branch", branchCode: digits.padStart(5, "0") };
}

// Excel drops leading zeros from numeric cells
function fixTaxId(v: string) {
  return /^\d{12}$/.test(v) ? `0${v}` : v;
}
function fixPhone(v: string) {
  return /^[1-9]\d{7,8}$/.test(v) ? `0${v}` : v;
}

export function classifyRows(
  rows: string[][],
  mapping: ColumnMapping,
  opts: { canEditFinancial: boolean },
  existing: ExistingCustomer[],
): ClassifiedRow[] {
  const byTax = new Map<string, ExistingCustomer>();
  const byPhone = new Map<string, ExistingCustomer>();
  for (const c of existing) {
    if (c.taxId) byTax.set(`${c.taxId}|${c.branchCode ?? "00000"}`, c);
    if (c.phoneNormalized && !byPhone.has(c.phoneNormalized)) byPhone.set(c.phoneNormalized, c);
  }
  const seenInFile = new Map<string, number>();

  const columnOf = Object.fromEntries(Object.entries(mapping).map(([col, field]) => [field, Number(col)])) as Partial<
    Record<ImportField, number>
  >;

  return rows.map((row, index): ClassifiedRow => {
    const rowNumber = index + 2;
    const cell = (f: ImportField) => (columnOf[f] === undefined ? "" : (row[columnOf[f]!] ?? "").trim());
    const provided = (Object.keys(columnOf) as ImportField[]).filter((f) => cell(f) !== "");
    const branch = parseBranch(cell("branch"));

    const values: Record<string, string> = {
      name: cell("name"),
      phone: fixPhone(cell("phone")),
      email: cell("email"),
      address: cell("address"),
      note: cell("note"),
      facebook: cell("facebook"),
      lineId: cell("lineId"),
      workplace: cell("workplace"),
      workplacePhone: cell("workplacePhone"),
      companyName: cell("companyName"),
      contactPerson: cell("contactPerson"),
      taxId: fixTaxId(cell("taxId")),
      ...branch,
      creditLimit: cell("creditLimit"),
      paymentTermDays: cell("paymentTermDays"),
      outstandingBalance: cell("outstandingBalance"),
    };
    const base = { index, rowNumber, name: values.name, taxId: values.taxId || null, phone: values.phone || null };

    const parsed = parseCustomerInput((k) => values[k] ?? "", [], opts);
    if (!parsed.ok) {
      const errors = Object.entries(parsed.errors).map(([k, msg]) => `${ERROR_LABELS[k] ?? k}: ${msg}`);
      return { ...base, status: "invalid", errors };
    }

    const { data } = parsed;
    const keys = [
      data.taxId && `tax:${data.taxId}|${data.branchCode}`,
      data.phoneNormalized && `phone:${data.phoneNormalized}`,
    ].filter((k): k is string => !!k);

    const earlier = keys.map((k) => seenInFile.get(k)).find((n) => n !== undefined);
    if (earlier !== undefined) {
      return { ...base, status: "invalid", errors: [`ข้อมูลซ้ำกับแถวที่ ${earlier} ในไฟล์ (เลขภาษีหรือเบอร์โทรเดียวกัน)`] };
    }
    for (const k of keys) seenInFile.set(k, rowNumber);

    const taxMatch = data.taxId ? byTax.get(`${data.taxId}|${data.branchCode}`) : undefined;
    const phoneMatch = data.phoneNormalized ? byPhone.get(data.phoneNormalized) : undefined;
    const match = taxMatch ?? phoneMatch;
    if (match) {
      return {
        ...base,
        status: "duplicate",
        data,
        provided,
        match: { id: match.id, code: match.code, name: match.name, by: taxMatch ? "taxId" : "phone" },
      };
    }
    return { ...base, status: "new", data, provided };
  });
}

/**
 * Update payload for "overwrite": only columns that were mapped AND non-empty
 * in this row — a blank cell never wipes existing data.
 */
export function updateDataFor(data: CustomerData, provided: ImportField[]): Partial<CustomerData> {
  const out: Partial<CustomerData> = {};
  const set = <K extends keyof CustomerData>(k: K) => {
    if (data[k] !== undefined) out[k] = data[k];
  };
  for (const f of provided) {
    if (f === "branch") {
      set("isHeadOffice");
      set("branchCode");
    } else if (f === "phone") {
      set("phone");
      set("phoneNormalized");
    } else {
      set(f);
    }
  }
  return out;
}
