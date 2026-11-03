import { NextResponse } from "next/server";
import { withFeature } from "@/lib/authz";
import { getLogoMime } from "@/server/company/queries";
import { readLogo } from "@/server/company/storage";

// GET /api/companies/:id/logo — a seller's logo printed on its tax invoices
export const GET = withFeature("viewCustomers", async (_req, ctx) => {
  const id = Number((await ctx.params).id);
  const mime = await getLogoMime(id);
  const data = mime ? await readLogo(id) : null;
  if (!mime || !data) return NextResponse.json({ error: "ไม่มีโลโก้" }, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": mime, "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" },
  });
});
