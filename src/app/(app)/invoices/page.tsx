import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/format";
import { listInvoices } from "@/server/invoices/queries";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const user = await requireFeature("createInvoice");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(sp.page) || 1;
  const { invoices, total, pageCount } = await listInvoices(user, { q, page });

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/invoices?${s}` : "/invoices";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ใบกำกับภาษี</h1>
          {!can(user, "viewFinancial") && <p className="text-sm text-slate-500">แสดงเฉพาะใบที่คุณออก</p>}
        </div>
        <Link href="/invoices/new" className={buttonPrimary}>
          + ออกใบกำกับภาษี
        </Link>
      </div>

      <form className="flex gap-2" action="/invoices">
        <input name="q" defaultValue={q} placeholder="ค้นหาเลขที่ ชื่อลูกค้า หรือเลขผู้เสียภาษี" className={inputClass} />
        <button className={buttonSecondary}>ค้นหา</button>
      </form>

      <p className="text-sm text-slate-500">{total.toLocaleString("th-TH")} ใบ</p>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">เลขที่</th>
              <th className="px-4 py-2.5 font-medium">วันที่</th>
              <th className="px-4 py-2.5 font-medium">ลูกค้า</th>
              <th className="px-4 py-2.5 text-right font-medium">ยอดเงินสุทธิ</th>
              <th className="px-4 py-2.5 font-medium">ออกโดย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className={inv.status === "CANCELLED" ? "text-slate-400" : "hover:bg-slate-50"}>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-700 hover:underline">
                    {inv.number}
                  </Link>
                  {inv.status === "CANCELLED" && <span className="ml-2 text-xs text-red-600">ยกเลิก</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">{formatDate(inv.issueDate)}</td>
                <td className="px-4 py-2.5">{inv.buyerName}</td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${inv.status === "CANCELLED" ? "line-through" : ""}`}>{formatMoney(inv.total)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{inv.createdBy}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  ยังไม่มีใบกำกับภาษี
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href(page - 1)} className={buttonSecondary}>← ก่อนหน้า</Link>}
          <span className="text-slate-500">หน้า {page} / {pageCount}</span>
          {page < pageCount && <Link href={href(page + 1)} className={buttonSecondary}>ถัดไป →</Link>}
        </nav>
      )}
    </div>
  );
}
