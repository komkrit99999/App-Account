import { formatTaxId } from "@/lib/thai-tax-id";
import type { CompanyDTO } from "@/server/company/queries";

/** Form values for the company form, from a saved company or blank for a new one */
export function companyFormValues(c: CompanyDTO | null): Record<string, string> {
  if (!c) return { branchType: "head", invoiceTemplate: "red", vatRate: "7" };
  return {
    nameTh: c.nameTh,
    nameEn: c.nameEn ?? "",
    addressTh: c.addressTh ?? "",
    addressEn: c.addressEn ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    lineId: c.lineId ?? "",
    lineOfficial: c.lineOfficial ?? "",
    facebook: c.facebook ?? "",
    taxId: c.taxId ? formatTaxId(c.taxId) : "",
    branchType: c.isHeadOffice ? "head" : "branch",
    branchCode: c.branchCode ?? "",
    headerNote: c.headerNote ?? "",
    footerNotes: c.footerNotes ?? "",
    invoiceTemplate: c.invoiceTemplate,
    vatRate: c.vatRate,
  };
}
