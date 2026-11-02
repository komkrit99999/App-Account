import { NextResponse } from "next/server";
import { withFeature } from "@/lib/authz";
import { getLogoMime } from "@/server/company/queries";
import { readLogo } from "@/server/company/storage";

// GET /api/company/logo — the seller logo printed on tax invoices
export const GET = withFeature("viewCustomers", async () => {
  const [mime, data] = await Promise.all([getLogoMime(), readLogo()]);
  if (!mime || !data) return NextResponse.json({ error: "ไม่มีโลโก้" }, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": mime, "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" },
  });
});
