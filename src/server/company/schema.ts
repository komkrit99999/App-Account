import { z } from "zod";
import { isValidThaiTaxId, normalizeTaxId } from "@/lib/thai-tax-id";
import { toHundredths } from "@/lib/invoice";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `ยาวเกิน ${max} ตัวอักษร`)
    .transform((v) => v || null);

export const companySchema = z
  .object({
    nameTh: z.string().trim().min(1, "กรอกชื่อบริษัท").max(200, "ยาวเกิน 200 ตัวอักษร"),
    nameEn: text(200),
    addressTh: z.string().trim().min(1, "กรอกที่อยู่").max(500, "ยาวเกิน 500 ตัวอักษร"),
    addressEn: text(500),
    phone: text(100),
    email: text(200),
    lineId: text(100),
    facebook: text(200),
    taxId: z
      .string()
      .transform(normalizeTaxId)
      .superRefine((v, ctx) => {
        if (!/^\d{13}$/.test(v)) ctx.addIssue({ code: "custom", message: "ต้องเป็นตัวเลข 13 หลัก" });
        else if (!isValidThaiTaxId(v)) ctx.addIssue({ code: "custom", message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (หลักสุดท้ายไม่ตรง)" });
      }),
    branchType: z.enum(["head", "branch"]),
    branchCode: z.string().trim(),
    headerNote: text(100),
    vatRate: z
      .string()
      .trim()
      .refine((v) => {
        const n = toHundredths(v);
        return n !== null && n <= 10000n;
      }, "ร้อยละ 0–100 ทศนิยมไม่เกิน 2 ตำแหน่ง"),
  })
  .superRefine((v, ctx) => {
    if (v.branchType === "branch" && (!/^\d{5}$/.test(v.branchCode) || v.branchCode === "00000")) {
      ctx.addIssue({ code: "custom", path: ["branchCode"], message: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก (ไม่ใช่ 00000)" });
    }
  })
  .transform(({ branchType, branchCode, ...rest }) => ({
    ...rest,
    isHeadOffice: branchType === "head",
    branchCode: branchType === "head" ? "00000" : branchCode,
  }));

export type CompanyInput = z.output<typeof companySchema>;

export const COMPANY_FIELDS = ["nameTh", "nameEn", "addressTh", "addressEn", "phone", "email", "lineId", "facebook", "taxId", "branchType", "branchCode", "headerNote", "vatRate"] as const;
