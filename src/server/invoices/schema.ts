import { z } from "zod";
import { lineAmount, toHundredths } from "@/lib/invoice";
import { isValidThaiTaxId, normalizeTaxId } from "@/lib/thai-tax-id";

export const MAX_ITEMS = 30;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `ยาวเกิน ${max} ตัวอักษร`)
    .transform((v) => v || null);

const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "วันที่ไม่ถูกต้อง")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const amount = (label: string, opts: { optional?: boolean; positive?: boolean } = {}) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .superRefine((v, ctx) => {
      if (v === "") {
        if (!opts.optional) ctx.addIssue({ code: "custom", message: `กรอก${label}` });
        return;
      }
      const n = toHundredths(v);
      if (n === null) ctx.addIssue({ code: "custom", message: "ตัวเลขไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)" });
      else if (opts.positive && n === 0n) ctx.addIssue({ code: "custom", message: `${label}ต้องมากกว่า 0` });
    });

const itemSchema = z.object({
  description: z.string().trim().min(1, "กรอกรายละเอียด").max(300, "ยาวเกิน 300 ตัวอักษร"),
  quantity: amount("จำนวน", { positive: true }),
  unit: text(20),
  unitPrice: amount("ราคาต่อหน่วย"),
  discount: amount("ส่วนลด", { optional: true }),
});

export const invoiceSchema = z
  .object({
    companyId: z.coerce.number().int().positive("เลือกบริษัทผู้ออกใบกำกับ"),
    number: z.string().trim().min(1, "กรอกเลขที่ใบกำกับ").max(40, "ยาวเกิน 40 ตัวอักษร"),
    customerId: z.string().min(1, "เลือกลูกค้า"),
    buyerName: z.string().trim().min(1, "กรอกชื่อลูกค้า").max(200, "ยาวเกิน 200 ตัวอักษร"),
    buyerBranch: text(50),
    buyerAddress: text(500),
    buyerTaxId: z
      .string()
      .transform(normalizeTaxId)
      .superRefine((v, ctx) => {
        if (v === "") return;
        if (!/^\d{13}$/.test(v)) ctx.addIssue({ code: "custom", message: "ต้องเป็นตัวเลข 13 หลัก" });
        else if (!isValidThaiTaxId(v)) ctx.addIssue({ code: "custom", message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (หลักสุดท้ายไม่ตรง)" });
      })
      .transform((v) => v || null),
    issueDate: dateOnly.refine((v) => v !== null, "ระบุวันที่"),
    dueDate: dateOnly,
    salesperson: text(100),
    projectName: text(200),
    purchaseOrderNo: text(50),
    reference: text(100),
    orderedBy: text(100),
    paymentTerm: text(100),
    remark: text(1000),
    items: z.array(itemSchema).min(1, "ต้องมีอย่างน้อย 1 รายการ").max(MAX_ITEMS, `ไม่เกิน ${MAX_ITEMS} รายการ`),
  })
  .superRefine((v, ctx) => {
    if (v.issueDate && v.dueDate && v.dueDate < v.issueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "ต้องไม่ก่อนวันที่ออกเอกสาร" });
    }
    v.items.forEach((item, i) => {
      const line = lineAmount(item);
      if (line !== null && line < 0n) {
        ctx.addIssue({ code: "custom", path: ["items", i, "discount"], message: "ส่วนลดมากกว่ายอดของรายการ" });
      }
    });
  })
  .transform((v) => ({ ...v, issueDate: v.issueDate! }));

export type InvoiceInput = z.output<typeof invoiceSchema>;
export type InvoiceFieldErrors = Partial<Record<string, string>>;

/** The form posts header fields normally and the item rows as one JSON field */
export type InvoiceFormValues = {
  fields: Record<string, string>;
  items: { description: string; quantity: string; unit: string; unitPrice: string; discount: string }[];
};

const HEADER_FIELDS = ["companyId", "number", "customerId", "buyerName", "buyerBranch", "buyerAddress", "buyerTaxId", "issueDate", "dueDate", "salesperson", "projectName", "purchaseOrderNo", "reference", "orderedBy", "paymentTerm", "remark"] as const;

export function invoiceFormValues(formData: FormData): InvoiceFormValues {
  let items: InvoiceFormValues["items"] = [];
  try {
    const parsed = JSON.parse(String(formData.get("items") ?? "[]"));
    if (Array.isArray(parsed)) {
      items = parsed.map((r) => ({
        description: String(r?.description ?? ""),
        quantity: String(r?.quantity ?? ""),
        unit: String(r?.unit ?? ""),
        unitPrice: String(r?.unitPrice ?? ""),
        discount: String(r?.discount ?? ""),
      }));
    }
  } catch {
    // treated as no items → validation error
  }
  return { fields: Object.fromEntries(HEADER_FIELDS.map((k) => [k, String(formData.get(k) ?? "")])), items };
}

export function parseInvoiceForm(formData: FormData): { ok: true; data: InvoiceInput } | { ok: false; errors: InvoiceFieldErrors } {
  const { fields, items } = invoiceFormValues(formData);
  // Rows left completely blank in the form are ignored
  const filled = items.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
  const result = invoiceSchema.safeParse({ ...fields, items: filled });
  if (result.success) return { ok: true, data: result.data };
  const errors: InvoiceFieldErrors = {};
  for (const issue of result.error.issues) {
    // "items.2.quantity" for row errors, "items" for the list itself
    const key = issue.path.length ? issue.path.join(".") : "form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
