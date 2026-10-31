import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { loansEnabled } from "@/lib/features";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, toDateInput, todayDateInput } from "@/lib/format";
import { MAX_INTEREST_RATE_PER_YEAR, dueDayLabel, isInterestDueOn, monthlyInterest } from "@/lib/loan";
import { listLoans, type LoanStatusFilter } from "@/server/loans/queries";
import { LoanStatusButton } from "@/components/loans/loan-status-button";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";

const STATUS_TABS: [LoanStatusFilter, string][] = [
  ["ACTIVE", "ยังไม่ปิดยอด"],
  ["CLOSED", "ปิดยอดแล้ว"],
  ["ALL", "ทั้งหมด"],
];

// Laid out like the paper/Excel ledger: one row per loan, ordered by interest due day
export default async function LoansPage({ searchParams }: PageProps<"/loans">) {
  // Checked in each page, not a layout: layouts and pages render in parallel,
  // so a layout's notFound() would not stop this page from streaming its data
  if (!loansEnabled()) notFound();
  // Everyone who can add loans sees this page; without viewFinancial only their own entries
  const user = await requireFeature("createLoan");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (STATUS_TABS.find(([s]) => s === sp.status)?.[0] ?? "ACTIVE") as LoanStatusFilter;
  const loans = await listLoans(user, { status, q });
  const canCreate = can(user, "createLoan");
  const canEdit = can(user, "editLoan");
  const seesAll = can(user, "viewFinancial");

  const today = new Date();
  const todayStr = todayDateInput(today);
  const active = loans.filter((l) => l.status === "ACTIVE");
  const totalPrincipal = active.reduce((sum, l) => sum + Number(l.principal), 0);
  const totalMonthly = active.reduce((sum, l) => sum + monthlyInterest(l.principal, l.interestRatePerYear), 0);

  const href = (next: { status?: LoanStatusFilter }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const s = next.status ?? status;
    if (s !== "ACTIVE") params.set("status", s);
    const str = params.toString();
    return str ? `/loans?${str}` : "/loans";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">เงินกู้</h1>
          <p className="text-sm text-slate-500">
            ดอกเบี้ยไม่เกินร้อยละ {MAX_INTEREST_RATE_PER_YEAR} ต่อปี{!seesAll && " · แสดงเฉพาะรายการที่คุณบันทึก"}
          </p>
        </div>
        {canCreate && (
          <Link href="/loans/new" className={buttonPrimary}>
            + เพิ่มเงินกู้
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="สัญญาที่ยังไม่ปิดยอด">{active.length.toLocaleString("th-TH")} สัญญา</Stat>
        <Stat label="เงินต้นคงค้างรวม">{formatMoney(String(totalPrincipal))} บาท</Stat>
        <Stat label="ดอกเบี้ยต่อเดือนรวม">{formatMoney(String(totalMonthly))} บาท</Stat>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 text-sm" aria-label="สถานะ">
          {STATUS_TABS.map(([s, label]) => (
            <Link
              key={s}
              href={href({ status: s })}
              aria-current={status === s ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${status === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/loans">
          {status !== "ACTIVE" && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ เบอร์โทร Facebook LINE" className={`${inputClass} w-72`} />
          <button className={buttonSecondary}>ค้นหา</button>
        </form>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="border-b border-emerald-200 bg-emerald-50 text-left text-emerald-900">
            <tr>
              <th className="px-3 py-2.5 font-medium">ชื่อผู้กู้</th>
              <th className="px-3 py-2.5 text-right font-medium">เงินต้น</th>
              <th className="px-3 py-2.5 font-medium">ดอกเบี้ย</th>
              <th className="px-3 py-2.5 font-medium">ส่งดอกทุก</th>
              <th className="px-3 py-2.5 font-medium">เบอร์โทร</th>
              <th className="px-3 py-2.5 font-medium">Facebook</th>
              <th className="px-3 py-2.5 font-medium">ID LINE</th>
              <th className="px-3 py-2.5 font-medium">ที่ทำงาน</th>
              <th className="px-3 py-2.5 font-medium">เบอร์ที่ทำงาน</th>
              <th className="px-3 py-2.5 font-medium">ที่อยู่</th>
              <th className="px-3 py-2.5 font-medium">กำหนดคืนต้น</th>
              {canEdit && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.map((l) => {
              const dueToday = l.status === "ACTIVE" && isInterestDueOn(l.interestDueDay, today);
              const overdue = l.status === "ACTIVE" && l.principalDueDate && toDateInput(l.principalDueDate) < todayStr;
              const c = l.customer;
              return (
                <tr key={l.id} className={`align-top ${l.status === "CLOSED" ? "text-slate-400" : "hover:bg-slate-50"}`}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/customers/${c.id}`} className="font-medium text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                    {c.deleted && <span className="ml-1 text-xs text-red-600">(ลูกค้าถูกลบ)</span>}
                    {l.status === "CLOSED" && <span className="ml-1 text-xs">(ปิดยอดแล้ว)</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatMoney(l.principal)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    ร้อยละ {Number(l.interestRatePerYear)} ต่อปี
                    <div className="text-xs text-slate-500">= {formatMoney(String(monthlyInterest(l.principal, l.interestRatePerYear)))} บาท/เดือน</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {dueDayLabel(l.interestDueDay)}
                    {dueToday && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">วันนี้</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{c.phone ?? "–"}</td>
                  <td className="px-3 py-2">{c.facebook ?? "–"}</td>
                  <td className="px-3 py-2">{c.lineId ?? "–"}</td>
                  <td className="px-3 py-2">{c.workplace ?? "–"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{c.workplacePhone ?? "–"}</td>
                  <td className="min-w-40 px-3 py-2">{c.address ?? "–"}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${overdue ? "font-medium text-red-700" : ""}`}>
                    {l.principalDueDate ? formatDate(l.principalDueDate) : "ไม่มีกำหนด"}
                    {overdue && <div className="text-xs">เลยกำหนด</div>}
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Link href={`/loans/${l.id}/edit`} className="mr-3 text-blue-700 hover:underline">
                        แก้ไข
                      </Link>
                      <LoanStatusButton id={l.id} status={l.status} />
                    </td>
                  )}
                </tr>
              );
            })}
            {loans.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 12 : 11} className="px-4 py-10 text-center text-slate-500">
                  ไม่พบรายการเงินกู้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{children}</p>
    </div>
  );
}
