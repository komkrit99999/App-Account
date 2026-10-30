import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { AUDIT_FIELDS, type VisibleChange } from "@/server/audit/diff";
import type { AuditLogDTO } from "@/server/history/queries";

export const ACTION_STYLE = {
  CREATE: { label: "เพิ่ม", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  UPDATE: { label: "แก้ไข", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  DELETE: { label: "ลบ", className: "bg-red-50 text-red-700 ring-red-200" },
} as const;

function show(change: VisibleChange, value: string | null) {
  if (value === null) return <span className="text-slate-400">(ว่าง)</span>;
  if (change.field === "creditLimit" || change.field === "outstandingBalance") return formatMoney(value);
  return value;
}

export function AuditEntry({ log, showCustomer = true }: { log: AuditLogDTO; showCustomer?: boolean }) {
  const style = ACTION_STYLE[log.action];
  // Creates and deletes list every field; only show the side that has values
  const oneSided = log.action !== "UPDATE";

  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${style.className}`}>{style.label}</span>
        {showCustomer &&
          (log.customerDeleted ? (
            <span className="font-medium">
              {log.customerLabel} <span className="text-xs text-red-600">(ถูกลบ)</span>
            </span>
          ) : (
            <Link href={`/customers/${log.customerId}`} className="font-medium text-blue-700 hover:underline">
              {log.customerLabel}
            </Link>
          ))}
        <span className="text-slate-500">
          โดย {log.userName} · {formatDateTime(log.createdAt)}
        </span>
        {log.importLog && (
          <Link href={`/import/${log.importLog.id}`} className="text-xs text-slate-500 underline hover:text-slate-700">
            จากไฟล์ {log.importLog.fileName}
          </Link>
        )}
      </div>

      <dl className="grid gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 sm:grid-cols-[minmax(8rem,auto)_1fr]">
        {log.changes.map((c) => (
          <div key={c.field} className="contents">
            <dt className="text-slate-500">{AUDIT_FIELDS[c.field].label}</dt>
            <dd className="break-words">
              {c.hidden ? (
                <span className="text-slate-400">มีการเปลี่ยนแปลง (ไม่มีสิทธิ์ดูข้อมูลการเงิน)</span>
              ) : oneSided ? (
                show(c, log.action === "DELETE" ? c.from : c.to)
              ) : (
                <>
                  <span className="text-red-700 line-through decoration-red-300">{show(c, c.from)}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="text-emerald-700">{show(c, c.to)}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
