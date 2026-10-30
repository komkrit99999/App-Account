import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { listAuditLogs, listExportLogs, listImportLogs, listUsersForFilter } from "@/server/history/queries";
import { ACTION_STYLE, AuditEntry } from "@/components/history/audit-entry";
import { buttonSecondary, cardClass, inputClass } from "@/components/ui";

const IMPORT_STATUS = {
  PREVIEW: { label: "รอยืนยัน", className: "text-amber-700" },
  COMPLETED: { label: "นำเข้าแล้ว", className: "text-emerald-700" },
  CANCELLED: { label: "ยกเลิก", className: "text-slate-500" },
} as const;

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const viewer = await requireFeature("viewOwnHistory");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tab = str("tab") === "imports" || str("tab") === "exports" ? str("tab") : "changes";
  const userId = str("user") || undefined;
  const action = str("action") || undefined;
  const page = Number(str("page")) || 1;
  const seesAll = can(viewer, "viewAllHistory");

  const users = await listUsersForFilter(viewer);

  const href = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { tab, user: userId, action, ...next };
    for (const [k, v] of Object.entries(merged)) {
      // Defaults stay out of the URL
      if (!v || (k === "tab" && v === "changes") || (k === "page" && String(v) === "1")) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/history?${s}` : "/history";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">ประวัติ</h1>
        <p className="text-sm text-slate-500">{seesAll ? "แสดงประวัติของผู้ใช้ทุกคน" : "แสดงเฉพาะประวัติของคุณ"}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
        <nav className="flex gap-1" aria-label="ประเภทประวัติ">
          {(
            [
              ["changes", "การแก้ไขลูกค้า"],
              ["imports", "การนำเข้าไฟล์"],
              ["exports", "การ Export"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={href({ tab: key, action: undefined, page: undefined })}
              aria-current={tab === key ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <form className="mb-2 flex flex-wrap gap-2" action="/history">
          {tab !== "changes" && <input type="hidden" name="tab" value={tab} />}
          {seesAll && (
            <select name="user" defaultValue={userId ?? ""} aria-label="ผู้ใช้" className={`${inputClass} w-auto`}>
              <option value="">ผู้ใช้ทุกคน</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          )}
          {tab === "changes" && (
            <select name="action" defaultValue={action ?? ""} aria-label="การกระทำ" className={`${inputClass} w-auto`}>
              <option value="">ทุกการกระทำ</option>
              {(Object.keys(ACTION_STYLE) as (keyof typeof ACTION_STYLE)[]).map((a) => (
                <option key={a} value={a}>
                  {ACTION_STYLE[a].label}
                </option>
              ))}
            </select>
          )}
          {(seesAll || tab === "changes") && <button className={buttonSecondary}>กรอง</button>}
        </form>
      </div>

      {tab === "changes" && <ChangesTab viewer={viewer} filter={{ userId, action, page }} href={href} />}
      {tab === "imports" && <ImportsTab viewer={viewer} filter={{ userId, page }} href={href} />}
      {tab === "exports" && <ExportsTab viewer={viewer} filter={{ userId, page }} href={href} />}
    </div>
  );
}

type Viewer = Awaited<ReturnType<typeof requireFeature>>;
type Href = (next: Record<string, string | number | undefined>) => string;

async function ChangesTab({ viewer, filter, href }: { viewer: Viewer; filter: { userId?: string; action?: string; page: number }; href: Href }) {
  const { logs, total, page, pageCount } = await listAuditLogs(viewer, filter);
  return (
    <>
      <p className="text-sm text-slate-500">{total.toLocaleString("th-TH")} รายการ</p>
      <ul className={`${cardClass} divide-y divide-slate-100`}>
        {logs.map((log) => (
          <AuditEntry key={log.id} log={log} />
        ))}
        {logs.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">ยังไม่มีประวัติ</li>}
      </ul>
      <Pager page={page} pageCount={pageCount} href={href} />
    </>
  );
}

async function ImportsTab({ viewer, filter, href }: { viewer: Viewer; filter: { userId?: string; page: number }; href: Href }) {
  const { logs, total, page, pageCount } = await listImportLogs(viewer, filter);
  return (
    <>
      <p className="text-sm text-slate-500">{total.toLocaleString("th-TH")} ไฟล์</p>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">วันที่</th>
              <th className="px-4 py-2.5 font-medium">ผู้อัปโหลด</th>
              <th className="px-4 py-2.5 font-medium">ไฟล์</th>
              <th className="px-4 py-2.5 font-medium">สถานะ</th>
              <th className="px-4 py-2.5 text-right font-medium">ทั้งหมด</th>
              <th className="px-4 py-2.5 text-right font-medium">สำเร็จ</th>
              <th className="px-4 py-2.5 text-right font-medium">ข้าม</th>
              <th className="px-4 py-2.5 text-right font-medium">ล้มเหลว</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDateTime(l.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{l.userName}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/import/${l.id}`} className="text-blue-700 hover:underline">
                    {l.fileName}
                  </Link>
                  <div className="text-xs text-slate-500">{(l.fileSize / 1024).toLocaleString("th-TH", { maximumFractionDigits: 0 })} KB</div>
                </td>
                <td className={`whitespace-nowrap px-4 py-2.5 ${IMPORT_STATUS[l.status].className}`}>{IMPORT_STATUS[l.status].label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.totalRows.toLocaleString("th-TH")}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {l.status === "COMPLETED" ? (
                    <span title={`เพิ่ม ${l.createdRows} · อัปเดต ${l.updatedRows}`}>{(l.createdRows + l.updatedRows).toLocaleString("th-TH")}</span>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.status === "COMPLETED" ? l.skippedRows.toLocaleString("th-TH") : "–"}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${l.failedRows ? "text-red-700" : ""}`}>
                  {l.status === "COMPLETED" ? l.failedRows.toLocaleString("th-TH") : "–"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {l.canDownload && (
                    <a href={`/api/import/${l.id}/file`} download className="text-blue-700 hover:underline">
                      ⬇ ดาวน์โหลด
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  ยังไม่มีการนำเข้าไฟล์
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageCount={pageCount} href={href} />
    </>
  );
}

async function ExportsTab({ viewer, filter, href }: { viewer: Viewer; filter: { userId?: string; page: number }; href: Href }) {
  const { logs, total, page, pageCount } = await listExportLogs(viewer, filter);
  return (
    <>
      <p className="text-sm text-slate-500">{total.toLocaleString("th-TH")} ครั้ง</p>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">วันที่</th>
              <th className="px-4 py-2.5 font-medium">ผู้ Export</th>
              <th className="px-4 py-2.5 font-medium">ไฟล์</th>
              <th className="px-4 py-2.5 font-medium">ตัวกรอง</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวน</th>
              <th className="px-4 py-2.5 font-medium">ข้อมูลการเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDateTime(l.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{l.userName}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{l.fileName}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {!l.filters.q && l.filters.tags.length === 0 && <span className="text-slate-400">ทั้งหมด</span>}
                  {l.filters.q && <div>ค้นหา “{l.filters.q}”</div>}
                  {l.filters.tags.length > 0 && <div>แท็ก: {l.filters.tags.map((t) => t.name).join(", ")}</div>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.rowCount.toLocaleString("th-TH")}</td>
                <td className={`whitespace-nowrap px-4 py-2.5 ${l.includesFinancial ? "text-amber-700" : "text-slate-500"}`}>
                  {l.includesFinancial ? "รวม" : "ไม่รวม"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  ยังไม่มีการ Export
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageCount={pageCount} href={href} />
    </>
  );
}

function Pager({ page, pageCount, href }: { page: number; pageCount: number; href: Href }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 text-sm">
      {page > 1 && <Link href={href({ page: page - 1 })} className={buttonSecondary}>← ก่อนหน้า</Link>}
      <span className="text-slate-500">
        หน้า {page} / {pageCount}
      </span>
      {page < pageCount && <Link href={href({ page: page + 1 })} className={buttonSecondary}>ถัดไป →</Link>}
    </nav>
  );
}
