import "server-only";
import type { db } from "@/lib/db";

type Tx = Pick<typeof db, "customer">;

/** Next number for codes like C00001. Call inside the transaction that creates the rows. */
export async function nextCodeNumber(tx: Tx): Promise<number> {
  const last = await tx.customer.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  return last ? Number(last.code.slice(1)) + 1 : 1;
}

export function formatCode(n: number): string {
  return `C${String(n).padStart(5, "0")}`;
}
