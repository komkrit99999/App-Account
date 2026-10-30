import { z } from "zod";
import { MAX_INTEREST_RATE_PER_YEAR } from "@/lib/loan";

const decimal = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => v !== "", `กรุณากรอก${label}`)
    .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "ตัวเลขไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)");

const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "วันที่ไม่ถูกต้อง")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

export const loanSchema = z
  .object({
    customerId: z.string().min(1, "กรุณาเลือกผู้กู้"),
    principal: decimal("เงินต้น").refine((v) => v === "" || Number(v) > 0, "เงินต้นต้องมากกว่า 0"),
    interestRatePerYear: decimal("อัตราดอกเบี้ย").refine(
      (v) => v === "" || Number(v) <= MAX_INTEREST_RATE_PER_YEAR,
      `ดอกเบี้ยต้องไม่เกินร้อยละ ${MAX_INTEREST_RATE_PER_YEAR} ต่อปีตามกฎหมาย (ป.พ.พ. มาตรา 654)`,
    ),
    interestDueDay: z
      .string()
      .trim()
      .refine((v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 31, "ต้องเป็นวันที่ 1–31")
      .transform(Number),
    startDate: dateOnly.refine((v) => v !== null, "กรุณาระบุวันที่ปล่อยกู้"),
    principalDueDate: dateOnly,
    note: z
      .string()
      .trim()
      .max(1000, "ยาวเกิน 1000 ตัวอักษร")
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.principalDueDate && v.principalDueDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["principalDueDate"], message: "ต้องไม่ก่อนวันที่ปล่อยกู้" });
    }
  })
  .transform((v) => ({ ...v, startDate: v.startDate! }));

export type LoanData = z.output<typeof loanSchema>;
export type LoanFormValues = Record<string, string>;
export type LoanFieldErrors = Partial<Record<string, string>>;

const FIELDS = ["customerId", "principal", "interestRatePerYear", "interestDueDay", "startDate", "principalDueDate", "note"] as const;

export function parseLoanForm(formData: FormData): { ok: true; data: LoanData } | { ok: false; errors: LoanFieldErrors } {
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const result = loanSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const errors: LoanFieldErrors = {};
  for (const issue of result.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false, errors };
}

export function loanFormValues(formData: FormData): LoanFormValues {
  return Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
}
