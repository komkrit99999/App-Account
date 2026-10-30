import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-5xl font-bold text-slate-300">403</p>
      <h1 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="text-sm text-slate-500">หากต้องการสิทธิ์เพิ่ม กรุณาติดต่อผู้ดูแลระบบ</p>
      <Link href="/" className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
        กลับหน้าแรก
      </Link>
    </main>
  );
}
