import "server-only";
import { db } from "@/lib/db";

/** Customers an invoice can be issued to, with the details that pre-fill the buyer box */
export function listBuyerOptions() {
  return db.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, companyName: true, address: true, taxId: true, isHeadOffice: true, branchCode: true },
    orderBy: { name: "asc" },
  });
}
