import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { IMPORT_FIELDS, guessMapping, importFieldsFor, normalizeHeader, type ImportField } from "@/lib/import-fields";
import { ImportWizard } from "@/components/import/import-wizard";
import { canDownloadImport, findVisibleImportLog } from "@/server/history/queries";
import { buttonPrimary, buttonSecondary, cardClass } from "@/components/ui";

const STATUS_TITLES = { PREVIEW: "รอยืนยันการนำเข้า", COMPLETED: "นำเข้าเรียบร้อย", CANCELLED: "ยกเลิกการนำเข้าแล้ว" } as const;

const FINANCIAL_FIELDS = (Object.keys(IMPORT_FIELDS) as ImportField[]).filter((f) => "financial" in IMPORT_FIELDS[f]);

export default async function ImportLogPage({ params }: PageProps<"/import/[batchId]">) {
  // Owners see their own imports; viewAllHistory sees everyone's (read-only)
  const user = await requireFeature("viewOwnHistory");
  const { batchId } = await params;
  const batch = await findVisibleImportLog(user, batchId);
  if (!batch) notFound();
  const isOwner = batch.userId === user.id;

  if (batch.status === "PREVIEW" && isOwner && can(user, "importExcel")) {
    const canEditFinancial = can(user, "editFinancial");
    const headers = JSON.parse(batch.headers) as string[];
    const rows = JSON.parse(batch.rows) as string[][];
    const allowedFields = importFieldsFor({ canEditFinancial });
    const blockedFinancialHeaders = canEditFinancial
      ? []
      : headers.filter((h) => FINANCIAL_FIELDS.some((f) => IMPORT_FIELDS[f].aliases.some((a) => normalizeHeader(a) === normalizeHeader(h))));

    return (
      <ImportWizard
        batchId={batch.id}
        fileName={batch.fileName}
        totalRows={batch.totalRows}
        headers={headers}
        previewRows={rows.slice(0, 10)}
        allowedFields={allowedFields}
        initialMapping={guessMapping(headers, allowedFields)}
        blockedFinancialHeaders={blockedFinancialHeaders}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{STATUS_TITLES[batch.status]}</h1>
        <p className="text-sm text-slate-500">
          {batch.fileName} · {batch.totalRows.toLocaleString("th-TH")} แถว · อัปโหลดโดย {batch.user.displayName} ·{" "}
          {formatDateTime(batch.completedAt ?? batch.createdAt)}
        </p>
      </div>

      {batch.status === "COMPLETED" && (
        <>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <Stat label="เพิ่มใหม่" value={batch.createdRows} className="text-emerald-700" />
            <Stat label="อัปเดตทับ" value={batch.updatedRows} className="text-blue-700" />
            <Stat label="ข้าม (ซ้ำ)" value={batch.skippedRows} className="text-amber-700" />
            <Stat label="ล้มเหลว" value={batch.failedRows} className="text-red-700" />
          </div>

          {batch.errors.length > 0 && (
            <section className={`${cardClass} p-5`}>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">แถวที่ไม่ได้นำเข้า</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {batch.errors.map((e) => (
                  <li key={e.id} className="flex gap-3 py-1.5">
                    <span className="w-16 shrink-0 text-slate-500">แถว {e.rowNumber}</span>
                    <span className="text-red-700">{e.message}</span>
                  </li>
                ))}
              </ul>
              {batch.failedRows > batch.errors.length && (
                <p className="mt-2 text-xs text-slate-500">แสดง {batch.errors.length} รายการแรก</p>
              )}
            </section>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {isOwner ? (
          <>
            <Link href="/customers" className={buttonPrimary}>
              ไปที่รายชื่อลูกค้า
            </Link>
            <Link href="/import" className={buttonSecondary}>
              นำเข้าไฟล์อื่น
            </Link>
          </>
        ) : (
          <Link href="/history?tab=imports" className={buttonSecondary}>
            ← ประวัติการนำเข้า
          </Link>
        )}
        {batch.fileStored && canDownloadImport(user, batch) && (
          <a href={`/api/import/${batch.id}/file`} download className={buttonSecondary}>
            ⬇ ดาวน์โหลดไฟล์ต้นฉบับ
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`${cardClass} px-3 py-3`}>
      <div className={`text-2xl font-semibold tabular-nums ${className}`}>{value.toLocaleString("th-TH")}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
