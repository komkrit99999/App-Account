"use client";

import { useActionState } from "react";
import { buttonPrimary, inputClass } from "@/components/ui";
import { uploadImportFile, type UploadState } from "@/server/import/actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadImportFile, {});
  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        required
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        aria-label="ไฟล์ Excel หรือ CSV"
        className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm`}
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={buttonPrimary}>
        {pending ? "กำลังอ่านไฟล์…" : "อัปโหลดและดูตัวอย่าง"}
      </button>
    </form>
  );
}
