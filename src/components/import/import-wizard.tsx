"use client";

import { useMemo, useState, useTransition } from "react";
import { buttonPrimary, buttonSecondary, cardClass } from "@/components/ui";
import { IMPORT_FIELDS, type ColumnMapping, type ImportField } from "@/lib/import-fields";
import { analyzeImport, cancelImport, commitImport, type ReviewRow } from "@/server/import/actions";

type Props = {
  batchId: string;
  fileName: string;
  totalRows: number;
  headers: string[];
  previewRows: string[][];
  allowedFields: ImportField[];
  initialMapping: ColumnMapping;
  /** Header names that look like financial columns but the user can't import */
  blockedFinancialHeaders: string[];
};

type Choice = "skip" | "update";
type Tab = "all" | ReviewRow["status"];

const STATUS_STYLE: Record<ReviewRow["status"], { label: string; className: string }> = {
  new: { label: "ใหม่", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  duplicate: { label: "ซ้ำ", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  invalid: { label: "ผิดพลาด", className: "bg-red-50 text-red-700 ring-red-200" },
};

const MAX_VISIBLE = 200;

export function ImportWizard(props: Props) {
  const { batchId, fileName, totalRows, headers, previewRows, allowedFields } = props;
  const [mapping, setMapping] = useState<ColumnMapping>(props.initialMapping);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateDefault, setDuplicateDefault] = useState<Choice>("skip");
  const [overrides, setOverrides] = useState<Record<number, Choice>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [pending, startTransition] = useTransition();

  const usedFields = Object.values(mapping);
  const nameMapped = usedFields.includes("name");

  const setColumn = (col: number, field: ImportField | "") => {
    setMapping((m) => {
      const next = { ...m };
      // A field can only be mapped once — moving it frees the old column
      for (const [c, f] of Object.entries(next)) if (f === field) delete next[Number(c)];
      if (field) next[col] = field;
      else delete next[col];
      return next;
    });
  };

  const analyze = () =>
    startTransition(async () => {
      setError(null);
      const res = await analyzeImport(batchId, mapping);
      if ("error" in res) setError(res.error);
      else {
        setReview(res.rows);
        setOverrides({});
        setTab("all");
      }
    });

  const commit = () =>
    startTransition(async () => {
      setError(null);
      const res = await commitImport(batchId, mapping, { duplicateDefault, overrides });
      if (res?.error) setError(res.error);
    });

  const cancel = () => {
    if (confirm("ยกเลิกการนำเข้าไฟล์นี้?")) startTransition(() => cancelImport(batchId));
  };

  const counts = useMemo(() => {
    const c = { new: 0, duplicate: 0, invalid: 0, update: 0 };
    for (const r of review ?? []) {
      c[r.status]++;
      if (r.status === "duplicate" && (overrides[r.index] ?? duplicateDefault) === "update") c.update++;
    }
    return c;
  }, [review, overrides, duplicateDefault]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">นำเข้าลูกค้า</h1>
        <p className="text-sm text-slate-500">
          {fileName} · {totalRows.toLocaleString("th-TH")} แถว
        </p>
      </div>
      <button onClick={cancel} disabled={pending} className={buttonSecondary}>
        ยกเลิกการนำเข้า
      </button>
    </div>
  );

  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  );

  // ---------- Step 1: map columns ----------
  if (!review) {
    return (
      <div className="space-y-5">
        {header}
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-semibold">1. จับคู่คอลัมน์</h2>
          <p className="text-sm text-slate-600">
            เลือกว่าแต่ละคอลัมน์ในไฟล์คือข้อมูลอะไร ระบบเดาให้จากชื่อหัวคอลัมน์แล้ว คอลัมน์ที่ไม่เลือกจะไม่ถูกนำเข้า
          </p>
          {props.blockedFinancialHeaders.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              คอลัมน์ {props.blockedFinancialHeaders.map((h) => `"${h}"`).join(", ")} เป็นข้อมูลการเงิน
              ซึ่งนำเข้าได้เฉพาะ Tier 2 ขึ้นไป ระบบจะไม่นำเข้าคอลัมน์นี้
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="w-10 px-2 py-2 text-xs font-normal text-slate-400">แถว</th>
                  {headers.map((h, col) => (
                    <th key={col} className="min-w-40 px-2 py-2 align-top font-medium">
                      <div className="mb-1.5 truncate text-slate-700" title={h}>
                        {h}
                      </div>
                      <select
                        value={mapping[col] ?? ""}
                        onChange={(e) => setColumn(col, e.target.value as ImportField | "")}
                        aria-label={`จับคู่คอลัมน์ ${h}`}
                        className={`w-full rounded-md border px-2 py-1 text-sm font-normal ${mapping[col] ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white text-slate-500"}`}
                      >
                        <option value="">— ไม่นำเข้า —</option>
                        {allowedFields.map((f) => (
                          <option key={f} value={f}>
                            {IMPORT_FIELDS[f].label}
                            {"required" in IMPORT_FIELDS[f] ? " *" : ""}
                            {usedFields.includes(f) && mapping[col] !== f ? " (ใช้แล้ว)" : ""}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 text-xs text-slate-400">{i + 2}</td>
                    {row.map((cell, col) => (
                      <td key={col} className={`max-w-56 truncate px-2 py-1.5 ${mapping[col] ? "" : "text-slate-400"}`} title={cell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            แสดง {previewRows.length} แถวแรกจาก {totalRows.toLocaleString("th-TH")} แถว
          </p>
        </section>

        {errorBox}
        <div className="flex items-center justify-end gap-3">
          {!nameMapped && <span className="text-sm text-amber-700">ต้องจับคู่คอลัมน์ &quot;ชื่อลูกค้า&quot;</span>}
          <button onClick={analyze} disabled={pending || !nameMapped} className={buttonPrimary}>
            {pending ? "กำลังตรวจสอบ…" : "ตรวจสอบข้อมูล →"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Step 2: review & confirm ----------
  const visible = review.filter((r) => tab === "all" || r.status === tab);
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "ทั้งหมด", count: review.length },
    { key: "new", label: "ลูกค้าใหม่", count: counts.new },
    { key: "duplicate", label: "ข้อมูลซ้ำ", count: counts.duplicate },
    { key: "invalid", label: "ผิดพลาด", count: counts.invalid },
  ];

  return (
    <div className="space-y-5">
      {header}

      <section className={`${cardClass} space-y-4 p-5`}>
        <h2 className="font-semibold">2. ตรวจสอบและยืนยัน</h2>

        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="จะเพิ่มใหม่" value={counts.new} className="text-emerald-700" />
          <Stat label="จะอัปเดตทับ" value={counts.update} className="text-blue-700" />
          <Stat label="จะข้าม (ซ้ำ)" value={counts.duplicate - counts.update} className="text-amber-700" />
          <Stat label="ผิดพลาด (ไม่นำเข้า)" value={counts.invalid} className="text-red-700" />
        </div>

        {counts.duplicate > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm">
            <span className="font-medium text-amber-900">ข้อมูลซ้ำ {counts.duplicate} แถว ค่าเริ่มต้น:</span>
            {(["skip", "update"] as const).map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="duplicateDefault"
                  checked={duplicateDefault === c}
                  onChange={() => {
                    setDuplicateDefault(c);
                    setOverrides({});
                  }}
                />
                {c === "skip" ? "ข้าม ไม่แก้ข้อมูลเดิม" : "อัปเดตทับข้อมูลเดิม"}
              </label>
            ))}
            <span className="w-full text-xs text-amber-800">
              อัปเดตทับเฉพาะคอลัมน์ที่จับคู่และมีค่า ช่องว่างในไฟล์จะไม่ลบข้อมูลเดิม เปลี่ยนรายแถวได้ในตารางด้านล่าง
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label} ({t.count.toLocaleString("th-TH")})
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">แถว</th>
                <th className="px-2 py-2 font-medium">สถานะ</th>
                <th className="px-2 py-2 font-medium">ชื่อลูกค้า</th>
                <th className="px-2 py-2 font-medium">เลขภาษี</th>
                <th className="px-2 py-2 font-medium">เบอร์โทร</th>
                <th className="px-2 py-2 font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.slice(0, MAX_VISIBLE).map((r) => (
                <tr key={r.index} className="align-top">
                  <td className="px-2 py-2 text-slate-500">{r.rowNumber}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_STYLE[r.status].className}`}>
                      {STATUS_STYLE[r.status].label}
                    </span>
                  </td>
                  <td className="px-2 py-2">{r.name || <span className="text-slate-400">(ว่าง)</span>}</td>
                  <td className="whitespace-nowrap px-2 py-2">{r.taxId ?? "–"}</td>
                  <td className="whitespace-nowrap px-2 py-2">{r.phone ?? "–"}</td>
                  <td className="px-2 py-2">
                    {r.errors && (
                      <ul className="space-y-0.5 text-red-700">
                        {r.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                    {r.match && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-600">
                          ซ้ำกับ {r.match.code} {r.match.name} ({r.match.by === "taxId" ? "เลขภาษี" : "เบอร์โทร"})
                        </span>
                        <select
                          value={overrides[r.index] ?? duplicateDefault}
                          onChange={(e) => setOverrides((o) => ({ ...o, [r.index]: e.target.value as Choice }))}
                          aria-label={`การจัดการแถว ${r.rowNumber}`}
                          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-sm"
                        >
                          <option value="skip">ข้าม</option>
                          <option value="update">อัปเดตทับ</option>
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-500">
                    ไม่มีรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {visible.length > MAX_VISIBLE && (
            <p className="mt-2 text-xs text-slate-500">
              แสดง {MAX_VISIBLE} แถวแรกจาก {visible.length.toLocaleString("th-TH")} แถว — แถวที่ไม่แสดงใช้ค่าเริ่มต้นด้านบน
            </p>
          )}
        </div>
      </section>

      {errorBox}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setReview(null)} disabled={pending} className={buttonSecondary}>
          ← แก้การจับคู่คอลัมน์
        </button>
        <button onClick={commit} disabled={pending || counts.new + counts.update === 0} className={buttonPrimary}>
          {pending ? "กำลังนำเข้า…" : `ยืนยันนำเข้า (เพิ่ม ${counts.new} · อัปเดต ${counts.update})`}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className={`text-2xl font-semibold tabular-nums ${className}`}>{value.toLocaleString("th-TH")}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
