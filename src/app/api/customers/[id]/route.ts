import { NextResponse } from "next/server";
import { withFeature } from "@/lib/authz";
import { getCustomer } from "@/server/customers/queries";

export const GET = withFeature("viewCustomers", async (_req, ctx, user) => {
  const { id } = await ctx.params;
  const customer = await getCustomer(user, String(id));
  if (!customer) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
  return NextResponse.json(customer);
});
