import "server-only";
import { db } from "@/lib/db";
import { can, type PermissionSubject } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type { CompanyDTO } from "@/server/company/queries";

// Invoices carry amounts, so they follow the loan rule (fail closed):
// viewFinancial → every invoice; createInvoice only → the ones you issued; neither → none.

type Viewer = PermissionSubject & { id: string };

function visibility(user: Viewer): Prisma.InvoiceWhereInput | null {
  if (can(user, "viewFinancial")) return {};
  if (can(user, "createInvoice")) return { createdById: user.id };
  return null;
}

export type SellerSnapshot = Omit<CompanyDTO, "invoicePrefix" | "vatRate" | "hasLogo">;

export const INVOICE_PAGE_SIZE = 30;

export async function listInvoices(user: Viewer, filter: { q?: string; page?: number }) {
  const visible = visibility(user);
  const page = Math.max(1, filter.page ?? 1);
  if (!visible) return { invoices: [], total: 0, page, pageCount: 1 };
  const q = filter.q?.trim();
  const where: Prisma.InvoiceWhereInput = {
    ...visible,
    ...(q && { OR: [{ number: { contains: q } }, { buyerName: { contains: q } }, { buyerTaxId: { contains: q.replace(/\D/g, "") || q } }] }),
  };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { seq: "desc" },
      skip: (page - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        buyerName: true,
        total: true,
        customerId: true,
        createdBy: { select: { displayName: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);
  return {
    invoices: rows.map(({ total, createdBy, ...r }) => ({ ...r, total: total.toFixed(2), createdBy: createdBy.displayName })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE)),
  };
}

export async function listInvoicesForCustomer(user: Viewer, customerId: string) {
  const visible = visibility(user);
  if (!visible) return [];
  const rows = await db.invoice.findMany({
    where: { ...visible, customerId },
    orderBy: { seq: "desc" },
    take: 10,
    select: { id: true, number: true, status: true, issueDate: true, total: true },
  });
  return rows.map((r) => ({ ...r, total: r.total.toFixed(2) }));
}

export async function getInvoice(user: Viewer, id: string) {
  const visible = visibility(user);
  if (!visible) return null;
  const row = await db.invoice.findFirst({
    where: { ...visible, id },
    include: {
      items: { orderBy: { position: "asc" } },
      createdBy: { select: { displayName: true } },
      updatedBy: { select: { displayName: true } },
    },
  });
  if (!row) return null;
  const { seller, subtotal, vatRate, vatAmount, total, items, createdBy, updatedBy, ...rest } = row;
  return {
    ...rest,
    seller: JSON.parse(seller) as SellerSnapshot,
    subtotal: subtotal.toFixed(2),
    vatRate: String(Number(vatRate)),
    vatAmount: vatAmount.toFixed(2),
    total: total.toFixed(2),
    createdBy: createdBy.displayName,
    updatedBy: updatedBy?.displayName ?? null,
    items: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: String(Number(i.quantity)),
      unit: i.unit,
      unitPrice: i.unitPrice.toFixed(2),
      discount: i.discount.toFixed(2),
      amount: i.amount.toFixed(2),
    })),
  };
}

export type InvoiceDTO = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
