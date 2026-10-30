import Link from "next/link";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { UploadForm } from "@/components/import/upload-form";
import { buttonSecondary, cardClass } from "@/components/ui";

const STATUS_LABELS = { PREVIEW: "รอยืนยัน", COMPLETED: "นำเข้าแล้ว", CANCELLED: "ยกเลิก" } as const;

export default async function ImportPage() {
  const user = await requireFeature("importExcel");
  const recent = await db.importLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, fileName: true, status: true, totalRows: true, createdRows: true, updatedRows: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">นำเข้าลูกค้าจาก Excel / CSV</h1>

      <section className={`${cardClass} space-y-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>เลือกไฟล์ .xlsx, .xls หรือ .csv (ไม่เกิน 5 MB, 5,000 แถว) แถวแรกต้องเป็นหัวคอลัมน์</li>
            <li>จับคู่คอลัมน์ในไฟล์กับข้อมูลลูกค้า</li>
            <li>ตรวจข้อมูลซ้ำ (เลขภาษี / เบอร์โทร) เลือกข้ามหรืออัปเดตทับ แล้วกดยืนยัน</li>
          </ol>
          <a href="/api/import/template" download className={buttonSecondary}>
            ⬇ ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>
        {!can(user, "editFinancial") && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            คอลัมน์ข้อมูลการเงิน (วงเงินเครดิต, เงื่อนไขชำระเงิน, ยอดค้างชำระ) นำเข้าได้เฉพาะ Tier 2 ขึ้นไป
            หากมีในไฟล์ ระบบจะไม่นำเข้าคอลัมน์เหล่านั้น
          </p>
        )}
        <UploadForm />
      </section>

      {recent.length > 0 && (
        <section className={`${cardClass} p-5`}>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">การนำเข้าล่าสุดของคุณ</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/import/${b.id}`} className="font-medium text-blue-700 hover:underline">
                  {b.fileName}
                </Link>
                <span className="text-slate-500">
                  {STATUS_LABELS[b.status]} · {b.totalRows.toLocaleString("th-TH")} แถว
                  {b.status === "COMPLETED" && ` · เพิ่ม ${b.createdRows} อัปเดต ${b.updatedRows}`} · {formatDateTime(b.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
