import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/dal";
import Link from "next/link";
import type { ReactNode } from "react";
import { TIER_LABELS, can, featuresOf } from "@/lib/permissions";
import { loansEnabled } from "@/lib/features";
import { PermissionsProvider } from "@/components/permissions-provider";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="mr-3 font-semibold">
              ระบบข้อมูลลูกค้า
            </Link>
            {can(user, "viewCustomers") && <NavLink href="/customers">ลูกค้า</NavLink>}
            {loansEnabled() && can(user, "createLoan") && <NavLink href="/loans">เงินกู้</NavLink>}
            {can(user, "importExcel") && <NavLink href="/import">นำเข้า</NavLink>}
            {can(user, "manageTags") && <NavLink href="/tags">แท็ก</NavLink>}
            {can(user, "viewOwnHistory") && <NavLink href="/history">ประวัติ</NavLink>}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {user.displayName}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {user.role === "ADMIN" ? "Admin · " : ""}
                {TIER_LABELS[user.tier]}
              </span>
            </span>
            <form action={logout}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <PermissionsProvider features={featuresOf(user)}>{children}</PermissionsProvider>
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100">
      {children}
    </Link>
  );
}
