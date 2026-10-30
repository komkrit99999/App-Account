import { NextResponse } from "next/server";
import { withFeature } from "@/lib/authz";
import { listCustomers } from "@/server/customers/queries";

// GET /api/customers?q=&tag=<id>&tag=<id>&page=
// `financial` is null for users without viewFinancial
export const GET = withFeature("viewCustomers", async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const result = await listCustomers(user, {
    q: sp.get("q") ?? undefined,
    tagIds: sp.getAll("tag"),
    page: Number(sp.get("page")) || 1,
  });
  return NextResponse.json(result);
});
