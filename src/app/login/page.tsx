import { redirect } from "next/navigation";
import { findCurrentUser } from "@/lib/dal";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await findCurrentUser()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">ระบบข้อมูลลูกค้า</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          เข้าสู่ระบบด้วยบัญชีที่ได้รับจากผู้ดูแลระบบ
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
