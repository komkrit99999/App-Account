import { z } from "zod";
import { isValidThaiTaxId, normalizeTaxId } from "@/lib/thai-tax-id";
import { normalizePhone } from "@/lib/phone";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `ยาวเกิน ${max} ตัวอักษร`)
    .transform((v) => v || null);

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/,/g, ""))
  .refine((v) => v === "" || /^-?\d{1,12}(\.\d{1,2})?$/.test(v), "ตัวเลขไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)")
  .transform((v) => v || null); // kept as string — Prisma Decimal accepts it without float rounding

export const basicSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อลูกค้า").max(200, "ยาวเกิน 200 ตัวอักษร"),
    phone: text(50).refine((v) => {
      if (v === null) return true;
      const len = normalizePhone(v).length;
      return len >= 9 && len <= 15;
    }, "เบอร์โทรไม่ถูกต้อง"),
    email: text(200).refine((v) => v === null || z.email().safeParse(v).success, "รูปแบบอีเมลไม่ถูกต้อง"),
    address: text(500),
    note: text(2000),
    facebook: text(200),
    lineId: text(100),
    workplace: text(200),
    // Free text: office numbers often carry extensions ("02-035-1400 ต่อ 409")
    workplacePhone: text(100),
    companyName: text(200),
    contactPerson: text(200),
    taxId: z
      .string()
      .transform(normalizeTaxId)
      .superRefine((v, ctx) => {
        if (v === "") return;
        if (!/^\d{13}$/.test(v)) ctx.addIssue({ code: "custom", message: "ต้องเป็นตัวเลข 13 หลัก" });
        else if (!isValidThaiTaxId(v)) ctx.addIssue({ code: "custom", message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (หลักสุดท้ายไม่ตรง)" });
      })
      .transform((v) => v || null),
    branchType: z.enum(["head", "branch"]),
    branchCode: z.string().trim(),
    tagIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.branchType !== "branch") return;
    if (!/^\d{5}$/.test(v.branchCode)) {
      ctx.addIssue({ code: "custom", path: ["branchCode"], message: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก" });
    } else if (v.branchCode === "00000") {
      ctx.addIssue({ code: "custom", path: ["branchCode"], message: "00000 คือสำนักงานใหญ่" });
    }
  })
  .transform(({ branchType, branchCode, ...rest }) => ({
    ...rest,
    phoneNormalized: rest.phone ? normalizePhone(rest.phone) : null,
    isHeadOffice: branchType === "head",
    branchCode: branchType === "head" ? "00000" : branchCode,
  }));

export const financialSchema = z.object({
  creditLimit: money.refine((v) => v === null || !v.startsWith("-"), "ต้องไม่ติดลบ"),
  paymentTermDays: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 365), "ต้องเป็นจำนวนวัน 0–365")
    .transform((v) => (v === "" ? null : Number(v))),
  outstandingBalance: money.transform((v) => v ?? "0"),
});

export type CustomerFormValues = { fields: Record<string, string>; tagIds: string[] };
export type FieldErrors = Partial<Record<string, string>>;

export type CustomerData = z.output<typeof basicSchema> & Partial<z.output<typeof financialSchema>>;

export type ParsedCustomer = { ok: true; data: CustomerData } | { ok: false; errors: FieldErrors };

/**
 * Parses the customer form. Financial fields are only read when the caller
 * may edit them — anything else submitted under those names is ignored.
 */
export function parseCustomerForm(formData: FormData, opts: { canEditFinancial: boolean }): ParsedCustomer {
  return parseCustomerInput(
    (key) => String(formData.get(key) ?? ""),
    formData.getAll("tagIds").map(String),
    opts,
  );
}

/** Shared by the form and the spreadsheet import */
export function parseCustomerInput(
  str: (key: string) => string,
  tagIds: string[],
  opts: { canEditFinancial: boolean },
): ParsedCustomer {
  const errors: FieldErrors = {};

  const basic = basicSchema.safeParse({
    name: str("name"),
    phone: str("phone"),
    email: str("email"),
    address: str("address"),
    note: str("note"),
    facebook: str("facebook"),
    lineId: str("lineId"),
    workplace: str("workplace"),
    workplacePhone: str("workplacePhone"),
    companyName: str("companyName"),
    contactPerson: str("contactPerson"),
    taxId: str("taxId"),
    branchType: str("branchType") === "branch" ? "branch" : "head",
    branchCode: str("branchCode"),
    tagIds,
  });
  if (!basic.success) collect(basic.error, errors);

  let financial: z.output<typeof financialSchema> | undefined;
  if (opts.canEditFinancial) {
    const result = financialSchema.safeParse({
      creditLimit: str("creditLimit"),
      paymentTermDays: str("paymentTermDays"),
      outstandingBalance: str("outstandingBalance"),
    });
    if (result.success) financial = result.data;
    else collect(result.error, errors);
  }

  if (!basic.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { ...basic.data, ...financial } };
}

function collect(error: z.ZodError, into: FieldErrors) {
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    into[key] ??= issue.message;
  }
}

/** Echo submitted values back so the form keeps them after a failed submit */
export function formValues(formData: FormData): CustomerFormValues {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$") || key === "tagIds") continue;
    fields[key] = String(value);
  }
  return { fields, tagIds: formData.getAll("tagIds").map(String) };
}
