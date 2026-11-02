import "server-only";
import { db } from "@/lib/db";

export type CompanyDTO = {
  nameTh: string;
  nameEn: string | null;
  addressTh: string | null;
  addressEn: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  facebook: string | null;
  taxId: string | null;
  isHeadOffice: boolean;
  branchCode: string | null;
  headerNote: string | null;
  invoicePrefix: string;
  vatRate: string;
  hasLogo: boolean;
};

/** Seller details (always returns something; blank until an admin fills it in) */
export async function getCompany(): Promise<CompanyDTO> {
  const row = await db.companySettings.findUnique({ where: { id: 1 } });
  const { id, updatedAt, logoMime, vatRate, ...rest } = row ?? {
    id: 1,
    updatedAt: new Date(),
    logoMime: null,
    vatRate: null,
    nameTh: "",
    nameEn: null,
    addressTh: null,
    addressEn: null,
    phone: null,
    email: null,
    lineId: null,
    facebook: null,
    taxId: null,
    isHeadOffice: true,
    branchCode: null,
    headerNote: null,
    invoicePrefix: "INV",
  };
  void id;
  void updatedAt;
  return { ...rest, vatRate: vatRate ? String(Number(vatRate)) : "7", hasLogo: !!logoMime };
}

/** A tax invoice needs at least the seller's name, address and tax ID */
export function isCompanyReady(c: CompanyDTO): boolean {
  return !!(c.nameTh && c.addressTh && c.taxId);
}

export async function getLogoMime(): Promise<string | null> {
  const row = await db.companySettings.findUnique({ where: { id: 1 }, select: { logoMime: true } });
  return row?.logoMime ?? null;
}
