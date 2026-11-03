import "server-only";
import { db } from "@/lib/db";
import type { Company } from "@/generated/prisma/client";
import { INVOICE_TEMPLATES, type InvoiceTemplate } from "./schema";

export type CompanyDTO = {
  id: number;
  nameTh: string;
  nameEn: string | null;
  addressTh: string | null;
  addressEn: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  lineOfficial: string | null;
  facebook: string | null;
  taxId: string | null;
  isHeadOffice: boolean;
  branchCode: string | null;
  headerNote: string | null;
  footerNotes: string | null;
  invoiceTemplate: InvoiceTemplate;
  vatRate: string;
  hasLogo: boolean;
};

function toDTO({ createdAt, updatedAt, logoMime, vatRate, invoiceTemplate, ...rest }: Company): CompanyDTO {
  void createdAt;
  void updatedAt;
  return {
    ...rest,
    invoiceTemplate: (INVOICE_TEMPLATES as readonly string[]).includes(invoiceTemplate) ? (invoiceTemplate as InvoiceTemplate) : "red",
    vatRate: String(Number(vatRate)),
    hasLogo: !!logoMime,
  };
}

export async function listCompanies(): Promise<CompanyDTO[]> {
  const rows = await db.company.findMany({ orderBy: { id: "asc" } });
  return rows.map(toDTO);
}

export async function getCompany(id: number): Promise<CompanyDTO | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await db.company.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

/** A tax invoice needs at least the seller's name, address and tax ID */
export function isCompanyReady(c: CompanyDTO): boolean {
  return !!(c.nameTh && c.addressTh && c.taxId);
}

export function logoUrl(c: Pick<CompanyDTO, "id" | "hasLogo">): string | null {
  return c.hasLogo ? `/api/companies/${c.id}/logo` : null;
}

export async function getLogoMime(id: number): Promise<string | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await db.company.findUnique({ where: { id }, select: { logoMime: true } });
  return row?.logoMime ?? null;
}

export async function countInvoices(companyId: number): Promise<number> {
  return db.invoice.count({ where: { companyId } });
}
