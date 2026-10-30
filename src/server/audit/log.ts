import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { db } from "@/lib/db";
import { diffSnapshots, EMPTY_SNAPSHOT, snapshotOf, type Snapshot } from "./diff";

type Tx = Pick<typeof db, "auditLog">;

/** Customer columns an audit snapshot needs (createManyAndReturn can't select relations) */
export const auditScalarSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  note: true,
  facebook: true,
  lineId: true,
  workplace: true,
  workplacePhone: true,
  companyName: true,
  taxId: true,
  isHeadOffice: true,
  branchCode: true,
  contactPerson: true,
  creditLimit: true,
  paymentTermDays: true,
  outstandingBalance: true,
} satisfies Prisma.CustomerSelect;

export const auditSelect = {
  ...auditScalarSelect,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.CustomerSelect;

type AuditRow = Prisma.CustomerGetPayload<{ select: typeof auditScalarSelect }>;

export type AuditEntryInput = {
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  customer: AuditRow;
  before: Snapshot;
  after: Snapshot;
  importLogId?: string;
};

/** Builds the row, or null when nothing actually changed */
export function auditEntry({ userId, action, customer, before, after, importLogId }: AuditEntryInput) {
  const changes = diffSnapshots(before, after);
  if (changes.length === 0) return null;
  return {
    userId,
    action,
    customerId: customer.id,
    customerLabel: `${customer.code} ${customer.name}`,
    changes: JSON.stringify(changes),
    importLogId,
  };
}

export async function logCustomerChange(tx: Tx, input: AuditEntryInput) {
  const entry = auditEntry(input);
  if (entry) await tx.auditLog.create({ data: entry });
}

export { snapshotOf, EMPTY_SNAPSHOT };
