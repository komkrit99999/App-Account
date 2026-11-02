"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { COMPANY_FIELDS, companySchema } from "./schema";
import { LOGO_MAX_BYTES, deleteLogo, saveLogo, sniffImage } from "./storage";

export type CompanyFormState = { errors?: Partial<Record<string, string>>; values?: Record<string, string>; saved?: boolean };

export async function saveCompany(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireFeature("manageCompany");
  const values = Object.fromEntries(COMPANY_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = companySchema.safeParse(values);
  const errors: Partial<Record<string, string>> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;

  // Logo: optional new file, or remove the current one
  const file = formData.get("logo");
  let logo: { data: Buffer; mime: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > LOGO_MAX_BYTES) errors.logo = "ไฟล์โลโก้ใหญ่เกิน 1 MB";
    else {
      const data = Buffer.from(await file.arrayBuffer());
      const mime = sniffImage(data);
      if (!mime) errors.logo = "รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP";
      else logo = { data, mime };
    }
  }
  if (!parsed.success || Object.keys(errors).length) return { errors, values };

  const removeLogo = formData.get("removeLogo") === "on";
  if (logo) await saveLogo(logo.data);
  else if (removeLogo) await deleteLogo();

  const data = {
    ...parsed.data,
    ...(logo ? { logoMime: logo.mime } : removeLogo ? { logoMime: null } : {}),
  };
  await db.companySettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/settings/company");
  return { saved: true };
}
