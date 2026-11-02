import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { loansEnabled } from "@/lib/features";
import { formatTaxId } from "@/lib/thai-tax-id";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { dueDayLabel, monthlyInterest } from "@/lib/loan";
import { listLoansForCustomer } from "@/server/loans/queries";
import { listInvoicesForCustomer } from "@/server/invoices/queries";
import { LoanStatusButton } from "@/components/loans/loan-status-button";
import { getCustomer } from "@/server/customers/queries";
import { listAuditLogs } from "@/server/history/queries";
import { AuditEntry } from "@/components/history/audit-entry";
import { TagBadge } from "@/components/tag-badge";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { buttonSecondary, cardClass } from "@/components/ui";

export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const user = await requireFeature("viewCustomers");
  const { id } = await params;
  const c = await getCustomer(user, id);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/customers" className="text-sm text-blue-600 hover:underline">
        ← รายชื่อลูกค้า
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{c.code}</p>
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          {c.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {c.tags.map((t) => (
                <TagBadge key={t.id} name={t.name} color={t.color} />
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {can(user, "editCustomer") && (
            <Link href={`/customers/${c.id}/edit`} className={buttonSecondary}>
              แก้ไข
            </Link>
          )}
          {can(user, "deleteCustomer") && <DeleteCustomerButton id={c.id} name={c.name} />}
        </div>
      </div>

      <Section title="ข้อมูลพื้นฐาน">
        <Item label="เบอร์โทร">{c.phone}</Item>
        <Item label="อีเมล">{c.email}</Item>
        <Item label="ที่อยู่" wide>{c.address}</Item>
        <Item label="หมายเหตุ" wide>{c.note}</Item>
      </Section>

      <Section title="ช่องทางติดต่อ / ที่ทำงาน">
        <Item label="Facebook">{c.facebook}</Item>
        <Item label="ID LINE">{c.lineId}</Item>
        <Item label="ที่ทำงาน">{c.workplace}</Item>
        <Item label="เบอร์ที่ทำงาน">{c.workplacePhone}</Item>
      </Section>

      <Section title="ข้อมูลภาษี / บริษัท">
        <Item label="ชื่อบริษัท">{c.companyName}</Item>
        <Item label="ผู้ติดต่อ">{c.contactPerson}</Item>
        <Item label="เลขประจำตัวผู้เสียภาษี">{c.taxId && formatTaxId(c.taxId)}</Item>
        <Item label="สำนักงาน">{c.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${c.branchCode}`}</Item>
      </Section>

      {c.financial && (
        <Section title="ข้อมูลการเงิน">
          <Item label="วงเงินเครดิต">{formatMoney(c.financial.creditLimit)} บาท</Item>
          <Item label="เงื่อนไขชำระเงิน">
            {c.financial.paymentTermDays != null ? `${c.financial.paymentTermDays} วัน` : null}
          </Item>
          <Item label="ยอดค้างชำระ">{formatMoney(c.financial.outstandingBalance)} บาท</Item>
        </Section>
      )}

      {can(user, "createInvoice") && <CustomerInvoices user={user} customerId={c.id} />}

      {loansEnabled() && can(user, "createLoan") && <CustomerLoans user={user} customerId={c.id} />}

      {can(user, "viewOwnHistory") && <CustomerHistory user={user} customerId={c.id} />}

      <p className="text-xs text-slate-500">
        สร้างโดย {c.createdBy} เมื่อ {formatDateTime(c.createdAt)}
        {c.updatedBy && ` · แก้ไขล่าสุดโดย ${c.updatedBy} เมื่อ ${formatDateTime(c.updatedAt)}`}
      </p>
    </div>
  );
}

async function CustomerInvoices({ user, customerId }: { user: Awaited<ReturnType<typeof requireFeature>>; customerId: string }) {
  const invoices = await listInvoicesForCustomer(user, customerId);
  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          ใบกำกับภาษี{!can(user, "viewFinancial") && " (เฉพาะที่คุณออก)"}
        </h2>
        <Link href={`/invoices/new?customer=${customerId}`} className="text-sm text-blue-700 hover:underline">
          + ออกใบกำกับภาษี
        </Link>
      </div>
      <ul className="divide-y divide-slate-100 text-sm">
        {invoices.map((inv) => (
          <li key={inv.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 ${inv.status === "CANCELLED" ? "text-slate-400" : ""}`}>
            <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-700 hover:underline">
              {inv.number}
            </Link>
            <span className="text-slate-500">{formatDate(inv.issueDate)}</span>
            <span className={`tabular-nums ${inv.status === "CANCELLED" ? "line-through" : ""}`}>{formatMoney(inv.total)} บาท</span>
          </li>
        ))}
        {invoices.length === 0 && <li className="px-5 py-6 text-center text-slate-500">ยังไม่มีใบกำกับภาษี</li>}
      </ul>
    </section>
  );
}

async function CustomerLoans({ user, customerId }: { user: Awaited<ReturnType<typeof requireFeature>>; customerId: string }) {
  const loans = await listLoansForCustomer(user, customerId);
  const canCreate = can(user, "createLoan");
  const canEdit = can(user, "editLoan");
  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          เงินกู้{!can(user, "viewFinancial") && " (เฉพาะที่คุณบันทึก)"}
        </h2>
        {canCreate && (
          <Link href={`/loans/new?customer=${customerId}`} className="text-sm text-blue-700 hover:underline">
            + เพิ่มเงินกู้
          </Link>
        )}
      </div>
      <ul className="divide-y divide-slate-100 text-sm">
        {loans.map((l) => (
          <li key={l.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${l.status === "CLOSED" ? "text-slate-400" : ""}`}>
            <div>
              <span className="font-medium tabular-nums">{formatMoney(l.principal)} บาท</span>
              <span className="ml-2">
                ร้อยละ {Number(l.interestRatePerYear)} ต่อปี = {formatMoney(String(monthlyInterest(l.principal, l.interestRatePerYear)))} บาท/เดือน
              </span>
              <div className="text-xs text-slate-500">
                ส่งดอกทุก{dueDayLabel(l.interestDueDay)} · ปล่อยกู้ {formatDate(l.startDate)} · คืนต้น{" "}
                {l.principalDueDate ? formatDate(l.principalDueDate) : "ไม่มีกำหนด"}
                {l.status === "CLOSED" && l.closedAt && ` · ปิดยอด ${formatDate(l.closedAt)}`}
              </div>
            </div>
            {canEdit && (
              <div className="whitespace-nowrap">
                <Link href={`/loans/${l.id}/edit`} className="mr-3 text-blue-700 hover:underline">
                  แก้ไข
                </Link>
                <LoanStatusButton id={l.id} status={l.status} />
              </div>
            )}
          </li>
        ))}
        {loans.length === 0 && <li className="px-5 py-6 text-center text-slate-500">ยังไม่มีเงินกู้</li>}
      </ul>
    </section>
  );
}

async function CustomerHistory({ user, customerId }: { user: Awaited<ReturnType<typeof requireFeature>>; customerId: string }) {
  const { logs, total } = await listAuditLogs(user, { customerId, take: 20 });
  return (
    <section className={cardClass}>
      <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
        ประวัติการเปลี่ยนแปลง{!can(user, "viewAllHistory") && " (เฉพาะที่คุณทำ)"}
      </h2>
      <ul className="divide-y divide-slate-100">
        {logs.map((log) => (
          <AuditEntry key={log.id} log={log} showCustomer={false} />
        ))}
        {logs.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">ยังไม่มีประวัติ</li>}
      </ul>
      {total > logs.length && (
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">แสดง {logs.length} รายการล่าสุดจาก {total}</p>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line">{children || "–"}</dd>
    </div>
  );
}
