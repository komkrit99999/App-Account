import { withFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { listCustomersForExport } from "@/server/customers/queries";
import { buildCustomerWorkbook } from "@/server/customers/export";

// GET /api/customers/export?q=&tag=<id>&tag=<id> — same filters as /customers, all pages.
// Financial columns are left out of the file for users without viewFinancial.
export const GET = withFeature("exportExcel", async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const tagIds = sp.getAll("tag");
  const includeFinancial = can(user, "viewFinancial");

  const [{ customers, total }, tags] = await Promise.all([
    listCustomersForExport(user, { q, tagIds }),
    db.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true } }),
  ]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  // Server-local time, same as formatDateTime() inside the file
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const fileName = `customers-${stamp}.xlsx`;
  const body = buildCustomerWorkbook(customers, {
    includeFinancial,
    meta: { exportedBy: user.displayName, exportedAt: now, q, tagNames: tags.map((t) => t.name), total },
  });

  await db.exportLog.create({
    data: {
      userId: user.id,
      fileName,
      filters: JSON.stringify({ q, tags }),
      rowCount: customers.length,
      includesFinancial: includeFinancial,
      createdAt: now,
    },
  });

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
