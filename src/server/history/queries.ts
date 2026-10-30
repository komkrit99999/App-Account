import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/dal";
import type { Prisma } from "@/generated/prisma/client";
import { redactChanges, type Change, type VisibleChange } from "@/server/audit/diff";

export const HISTORY_PAGE_SIZE = 30;

/**
 * Tier 3 and admins see everyone's history; everyone else only their own.
 * Every history query goes through this.
 */
function visibleTo(viewer: CurrentUser, requestedUserId?: string): { userId?: string } {
  if (!can(viewer, "viewAllHistory")) return { userId: viewer.id };
  return requestedUserId ? { userId: requestedUserId } : {};
}

/** Others' uploads may hold financial columns, so downloading them also needs viewFinancial */
export function canDownloadImport(viewer: CurrentUser, log: { userId: string }): boolean {
  return log.userId === viewer.id || (can(viewer, "viewAllHistory") && can(viewer, "viewFinancial"));
}

export type AuditLogDTO = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  createdAt: Date;
  userName: string;
  customerId: string;
  customerLabel: string;
  customerDeleted: boolean;
  importLog: { id: string; fileName: string } | null;
  changes: VisibleChange[];
};

export async function listAuditLogs(
  viewer: CurrentUser,
  filter: { userId?: string; action?: string; customerId?: string; page?: number; take?: number },
) {
  const take = filter.take ?? HISTORY_PAGE_SIZE;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {
    ...visibleTo(viewer, filter.userId),
    ...(filter.customerId && { customerId: filter.customerId }),
    ...((filter.action === "CREATE" || filter.action === "UPDATE" || filter.action === "DELETE") && { action: filter.action }),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        action: true,
        createdAt: true,
        customerId: true,
        customerLabel: true,
        changes: true,
        user: { select: { displayName: true } },
        customer: { select: { deletedAt: true } },
        importLog: { select: { id: true, fileName: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  const canViewFinancial = can(viewer, "viewFinancial");
  const logs: AuditLogDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.createdAt,
    userName: r.user.displayName,
    customerId: r.customerId,
    customerLabel: r.customerLabel,
    customerDeleted: !!r.customer.deletedAt,
    importLog: r.importLog,
    // Financial old/new values never leave the server for viewers without viewFinancial
    changes: redactChanges(JSON.parse(r.changes) as Change[], canViewFinancial),
  }));

  return { logs, total, page, pageCount: Math.max(1, Math.ceil(total / take)) };
}

export async function listImportLogs(viewer: CurrentUser, filter: { userId?: string; page?: number }) {
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.ImportLogWhereInput = visibleTo(viewer, filter.userId);

  const [rows, total] = await Promise.all([
    db.importLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        fileName: true,
        fileSize: true,
        fileStored: true,
        status: true,
        totalRows: true,
        createdRows: true,
        updatedRows: true,
        skippedRows: true,
        failedRows: true,
        createdAt: true,
        completedAt: true,
        user: { select: { displayName: true } },
      },
    }),
    db.importLog.count({ where }),
  ]);

  return {
    logs: rows.map(({ user, ...r }) => ({
      ...r,
      userName: user.displayName,
      canDownload: r.fileStored && canDownloadImport(viewer, r),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
  };
}

export type ExportFilters = { q: string; tags: { id: string; name: string }[] };

export async function listExportLogs(viewer: CurrentUser, filter: { userId?: string; page?: number }) {
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.ExportLogWhereInput = visibleTo(viewer, filter.userId);

  const [rows, total] = await Promise.all([
    db.exportLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: {
        id: true,
        fileName: true,
        filters: true,
        rowCount: true,
        includesFinancial: true,
        createdAt: true,
        user: { select: { displayName: true } },
      },
    }),
    db.exportLog.count({ where }),
  ]);

  return {
    logs: rows.map(({ user, filters, ...r }) => ({
      ...r,
      filters: JSON.parse(filters) as ExportFilters,
      userName: user.displayName,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
  };
}

/** A single import log the viewer is allowed to see, or null */
export function findVisibleImportLog(viewer: CurrentUser, id: string) {
  return db.importLog.findFirst({
    where: { id, ...visibleTo(viewer) },
    include: {
      user: { select: { displayName: true } },
      errors: { orderBy: { rowNumber: "asc" }, take: 500 },
    },
  });
}

export function listUsersForFilter(viewer: CurrentUser) {
  if (!can(viewer, "viewAllHistory")) return Promise.resolve([]);
  return db.user.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true } });
}
