"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { COMPANY_FIELDS, companySchema } from "./schema";
import { LOGO_MAX_BYTES, deleteLogo, saveLogo, sniffImage } from "./storage";

export type CompanyFormState = { errors?: Partial<Record<string, string>>; values?: Record<string, string>; saved?: boolean };

/** Creates a company when `id` is null (then redirects to it), otherwise updates that company */
export async function saveCompany(id: number | null, _prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireFeature("manageCompany");
  if (id !== null && !(await db.company.findUnique({ where: { id }, select: { id: true } }))) {
    return { errors: { form: "ไม่พบบริษัทนี้" } };
  }

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
  const logoData = logo ? { logoMime: logo.mime } : removeLogo ? { logoMime: null } : {};

  const companyId = id ?? (await db.company.create({ data: { ...parsed.data, ...logoData }, select: { id: true } })).id;
  if (logo) await saveLogo(companyId, logo.data);
  else if (removeLogo) await deleteLogo(companyId);
  if (id !== null) await db.company.update({ where: { id }, data: { ...parsed.data, ...logoData } });

  revalidatePath("/settings/company");
  revalidatePath("/invoices");
  if (id === null) redirect(`/settings/company/${companyId}?created=1`);
  return { saved: true };
}

/** Only companies that never issued an invoice can be removed */
export async function deleteCompany(id: number): Promise<{ error: string }> {
  await requireFeature("manageCompany");
  const invoices = await db.invoice.count({ where: { companyId: id } });
  if (invoices > 0) return { error: `ลบไม่ได้ บริษัทนี้ออกใบกำกับไปแล้ว ${invoices} ใบ` };
  await db.company.deleteMany({ where: { id } });
  await deleteLogo(id);
  revalidatePath("/settings/company");
  revalidatePath("/invoices");
  redirect("/settings/company");
}
