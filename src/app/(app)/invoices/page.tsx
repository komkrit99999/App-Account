import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/format";
import { listInvoices } from "@/server/invoices/queries";
import { listCompanies } from "@/server/company/queries";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const user = await requireFeature("createInvoice");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(sp.page) || 1;
  const companies = await listCompanies();
  // Tab per company; no tab = all companies
  const company = companies.find((c) => String(c.id) === sp.company);
  const { invoices, total, pageCount } = await listInvoices(user, { q, page, companyId: company?.id });

  const href = (next: { page?: number; company?: number | null }) => {
    const params = new URLSearchParams();
    const companyId = next.company === undefined ? company?.id : next.company;
    if (companyId) params.set("company", String(companyId));
    if (q && next.company === undefined) params.set("q", q);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const s = params.toString();
    return s ? `/invoices?${s}` : "/invoices";
  };
  const newHref = company ? `/invoices/new?company=${company.id}` : "/invoices/new";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ใบกำกับภาษี</h1>
          {!can(user, "viewFinancial") && <p className="text-sm text-slate-500">แสดงเฉพาะใบที่คุณออก</p>}
        </div>
        <Link href={newHref} className={buttonPrimary}>
          + ออกใบกำกับภาษี{company && ` · ${company.nameTh}`}
        </Link>
      </div>

      {companies.length > 1 && (
        <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="บริษัท">
          {[{ id: null, nameTh: "ทุกบริษัท" }, ...companies].map((c) => {
            const active = (company?.id ?? null) === c.id;
            return (
              <Link
                key={c.id ?? "all"}
                href={href({ company: c.id })}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${active ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {c.nameTh}
              </Link>
            );
          })}
        </nav>
      )}

      <form className="flex gap-2" action="/invoices">
        {company && <input type="hidden" name="company" value={company.id} />}
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
              {!company && companies.length > 1 && <th className="px-4 py-2.5 font-medium">บริษัท</th>}
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
                {!company && companies.length > 1 && <td className="px-4 py-2.5 text-slate-600">{inv.company.nameTh}</td>}
                <td className="px-4 py-2.5">{inv.buyerName}</td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${inv.status === "CANCELLED" ? "line-through" : ""}`}>{formatMoney(inv.total)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{inv.createdBy}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  ยังไม่มีใบกำกับภาษี
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href({ page: page - 1 })} className={buttonSecondary}>← ก่อนหน้า</Link>}
          <span className="text-slate-500">หน้า {page} / {pageCount}</span>
          {page < pageCount && <Link href={href({ page: page + 1 })} className={buttonSecondary}>ถัดไป →</Link>}
        </nav>
      )}
    </div>
  );
}
