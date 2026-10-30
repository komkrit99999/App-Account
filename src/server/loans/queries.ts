import "server-only";
import { db } from "@/lib/db";
import { can, type PermissionSubject } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

// Loans are financial data. Every query applies loanVisibility() (fail closed):
// viewFinancial → all loans; createLoan only → just the loans you entered yourself;
// neither → nothing.

const loanSelect = {
  id: true,
  principal: true,
  interestRatePerYear: true,
  interestDueDay: true,
  startDate: true,
  principalDueDate: true,
  status: true,
  note: true,
  closedAt: true,
  createdAt: true,
  createdBy: { select: { displayName: true } },
  customer: {
    select: {
      id: true,
      code: true,
      name: true,
      phone: true,
      facebook: true,
      lineId: true,
      workplace: true,
      workplacePhone: true,
      address: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.LoanSelect;

type Row = Prisma.LoanGetPayload<{ select: typeof loanSelect }>;

export type LoanDTO = Omit<Row, "principal" | "interestRatePerYear" | "createdBy" | "customer"> & {
  principal: string;
  interestRatePerYear: string;
  createdBy: string;
  customer: Omit<Row["customer"], "deletedAt"> & { deleted: boolean };
};

function toDTO({ principal, interestRatePerYear, createdBy, customer: { deletedAt, ...customer }, ...r }: Row): LoanDTO {
  return {
    ...r,
    principal: principal.toFixed(2),
    interestRatePerYear: interestRatePerYear.toFixed(2),
    createdBy: createdBy.displayName,
    customer: { ...customer, deleted: !!deletedAt },
  };
}

type Viewer = PermissionSubject & { id: string };

function loanVisibility(user: Viewer): Prisma.LoanWhereInput | null {
  if (can(user, "viewFinancial")) return {};
  if (can(user, "createLoan")) return { createdById: user.id };
  return null;
}

export type LoanStatusFilter = "ACTIVE" | "CLOSED" | "ALL";

export async function listLoans(user: Viewer, filter: { status: LoanStatusFilter; q?: string }) {
  const visible = loanVisibility(user);
  if (!visible) return [];
  const q = filter.q?.trim();
  const rows = await db.loan.findMany({
    where: {
      ...visible,
      ...(filter.status !== "ALL" && { status: filter.status }),
      ...(q && {
        customer: {
          OR: [{ name: { contains: q } }, { code: { contains: q } }, { phone: { contains: q } }, { facebook: { contains: q } }, { lineId: { contains: q } }],
        },
      }),
    },
    select: loanSelect,
    // Same order as a collection round: by interest due day
    orderBy: [{ interestDueDay: "asc" }, { customer: { name: "asc" } }, { startDate: "asc" }],
  });
  return rows.map(toDTO);
}

export async function listLoansForCustomer(user: Viewer, customerId: string) {
  const visible = loanVisibility(user);
  if (!visible) return [];
  const rows = await db.loan.findMany({
    where: { ...visible, customerId },
    select: loanSelect,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  return rows.map(toDTO);
}

export async function getLoan(user: Viewer, id: string) {
  const visible = loanVisibility(user);
  if (!visible) return null;
  const row = await db.loan.findFirst({ where: { ...visible, id }, select: loanSelect });
  return row ? toDTO(row) : null;
}

/** Customers a new loan can be attached to */
export function listBorrowerOptions() {
  return db.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}
