import "server-only";
import { db } from "@/lib/db";
import { can, type PermissionSubject } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import type { Prisma } from "@/generated/prisma/client";

const baseSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  note: true,
  companyName: true,
  taxId: true,
  isHeadOffice: true,
  branchCode: true,
  contactPerson: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } }, orderBy: { tag: { name: "asc" } } },
} satisfies Prisma.CustomerSelect;

const financialSelect = {
  creditLimit: true,
  paymentTermDays: true,
  outstandingBalance: true,
} satisfies Prisma.CustomerSelect;

const fullSelect = { ...baseSelect, ...financialSelect };

type BaseRow = Prisma.CustomerGetPayload<{ select: typeof baseSelect }>;
type FinancialRow = Prisma.CustomerGetPayload<{ select: typeof financialSelect }>;
type Row = BaseRow & Partial<FinancialRow>;

export type CustomerFinancial = {
  creditLimit: string | null;
  paymentTermDays: number | null;
  outstandingBalance: string;
};

export type CustomerTagDTO = { id: string; name: string; color: string };

export type CustomerDTO = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  companyName: string | null;
  taxId: string | null;
  isHeadOffice: boolean;
  branchCode: string | null;
  contactPerson: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string | null;
  tags: CustomerTagDTO[];
  /** null when the viewer lacks viewFinancial — the columns are never even read */
  financial: CustomerFinancial | null;
};

// Financial columns are left out of the SQL query entirely for users without
// viewFinancial, and toDTO() drops them again as a second line of defence.
function selectFor(user: PermissionSubject) {
  return (can(user, "viewFinancial") ? fullSelect : baseSelect) as typeof fullSelect;
}

function toDTO(row: Row, user: PermissionSubject): CustomerDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    note: row.note,
    companyName: row.companyName,
    taxId: row.taxId,
    isHeadOffice: row.isHeadOffice,
    branchCode: row.branchCode,
    contactPerson: row.contactPerson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy.displayName,
    updatedBy: row.updatedBy?.displayName ?? null,
    tags: row.tags.map((t) => t.tag),
    financial: can(user, "viewFinancial")
      ? {
          creditLimit: row.creditLimit?.toFixed(2) ?? null,
          paymentTermDays: row.paymentTermDays ?? null,
          outstandingBalance: row.outstandingBalance?.toFixed(2) ?? "0.00",
        }
      : null,
  };
}

export const PAGE_SIZE = 20;

export type CustomerListParams = { q?: string; tagIds?: string[]; page?: number };

/** Shared by the list page and the export, so an export matches what's on screen */
function customerWhere(params: Pick<CustomerListParams, "q" | "tagIds">): Prisma.CustomerWhereInput {
  const q = params.q?.trim() ?? "";
  const tagIds = params.tagIds ?? [];

  const and: Prisma.CustomerWhereInput[] = [];
  if (q) {
    const digits = normalizePhone(q);
    const or: Prisma.CustomerWhereInput[] = [
      { name: { contains: q } },
      { companyName: { contains: q } },
      { contactPerson: { contains: q } },
      { email: { contains: q } },
      { code: { contains: q } },
    ];
    if (digits.length >= 3) {
      or.push({ phoneNormalized: { contains: digits } }, { taxId: { contains: q.replace(/\D/g, "") } });
    }
    and.push({ OR: or });
  }
  // Selecting several tags narrows the list: customer must have all of them
  for (const tagId of tagIds) and.push({ tags: { some: { tagId } } });

  return { deletedAt: null, AND: and };
}

export async function listCustomers(user: PermissionSubject, params: CustomerListParams) {
  const page = Math.max(1, params.page ?? 1);
  const where = customerWhere(params);

  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      select: selectFor(user),
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
  ]);

  return {
    customers: rows.map((r) => toDTO(r, user)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Upper bound for one export file */
export const EXPORT_MAX_ROWS = 50_000;

/** Every customer matching the list filters (no paging), in the same order as the list */
export async function listCustomersForExport(user: PermissionSubject, params: Pick<CustomerListParams, "q" | "tagIds">) {
  const where = customerWhere(params);
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, select: selectFor(user), orderBy: { updatedAt: "desc" }, take: EXPORT_MAX_ROWS }),
    db.customer.count({ where }),
  ]);
  return { customers: rows.map((r) => toDTO(r, user)), total };
}

export async function getCustomer(user: PermissionSubject, id: string): Promise<CustomerDTO | null> {
  const row = await db.customer.findFirst({ where: { id, deletedAt: null }, select: selectFor(user) });
  return row ? toDTO(row, user) : null;
}
