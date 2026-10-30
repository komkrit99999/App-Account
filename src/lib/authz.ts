import "server-only";
import { forbidden } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { findCurrentUser, getCurrentUser, type CurrentUser } from "@/lib/dal";
import { can, type Feature } from "@/lib/permissions";

/**
 * For Server Components and Server Actions.
 * Not logged in → redirect to /login. Missing feature → 403 (forbidden.tsx).
 */
export async function requireFeature(feature: Feature): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!can(user, feature)) forbidden();
  return user;
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };
type GuardedHandler = (req: NextRequest, ctx: RouteContext, user: CurrentUser) => Promise<Response>;

/**
 * For Route Handlers (src/app/api/**). Responds with JSON 401/403 instead of
 * redirecting. Every route outside api/auth must be wrapped in this —
 * enforced by src/lib/permissions.test.ts.
 */
export function withFeature(feature: Feature, handler: GuardedHandler) {
  return async (req: NextRequest, ctx: RouteContext) => {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    if (!can(user, feature)) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์ใช้งานฟีเจอร์นี้", feature }, { status: 403 });
    }
    return handler(req, ctx, user);
  };
}
