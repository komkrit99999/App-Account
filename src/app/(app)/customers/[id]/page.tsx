import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatTaxId } from "@/lib/thai-tax-id";
import { formatDateTime, formatMoney } from "@/lib/format";
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

      {can(user, "viewOwnHistory") && <CustomerHistory user={user} customerId={c.id} />}

      <p className="text-xs text-slate-500">
        สร้างโดย {c.createdBy} เมื่อ {formatDateTime(c.createdAt)}
        {c.updatedBy && ` · แก้ไขล่าสุดโดย ${c.updatedBy} เมื่อ ${formatDateTime(c.updatedAt)}`}
      </p>
    </div>
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
