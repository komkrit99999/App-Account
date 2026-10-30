import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  tier: number;
};

// The JWT only carries the user id. Role, tier and isActive are re-read from
// the DB on every request so admin changes apply immediately.
export const findCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, displayName: true, role: true, tier: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    tier: user.tier,
  };
});

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await findCurrentUser();
  if (!user) redirect("/login");
  return user;
}
