"use client";

import { useActionState, useState, type ReactNode } from "react";
import { buttonPrimary, cardClass, inputClass } from "@/components/ui";
import type { CompanyFormState } from "@/server/company/actions";


export function CompanyForm({ action, initial, hasLogo }: { action: (prev: CompanyFormState, fd: FormData) => Promise<CompanyFormState>; initial: Record<string, string>; hasLogo: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [branchType, setBranchType] = useState(values.branchType ?? "head");

  const field = (name: string, label: string, opts: { required?: boolean; placeholder?: string; hint?: string; wide?: boolean; textarea?: boolean } = {}) => (
    <div className={`space-y-1.5 ${opts.wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
        {opts.required && <span className="text-red-500"> *</span>}
      </label>
      {opts.textarea ? (
        <textarea id={name} name={name} rows={2} defaultValue={values[name] ?? ""} aria-invalid={!!errors[name]} className={inputClass} />
      ) : (
        <input id={name} name={name} placeholder={opts.placeholder} defaultValue={values[name] ?? ""} aria-invalid={!!errors[name]} className={inputClass} />
      )}
      {errors[name] ? <p className="text-sm text-red-600">{errors[name]}</p> : opts.hint && <p className="text-xs text-slate-500">{opts.hint}</p>}
    </div>
  );

  return (
    <form action={formAction} key={JSON.stringify(state.values ?? null)} className="space-y-6" noValidate>
      {state.saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">บันทึกแล้ว</p>}

      <Section title="ชื่อและที่อยู่ (แสดงบนหัวใบกำกับภาษี)">
        {field("nameTh", "ชื่อบริษัท (ไทย)", { required: true, placeholder: "บริษัท ตัวอย่าง จำกัด" })}
        {field("nameEn", "ชื่อบริษัท (อังกฤษ)", { placeholder: "EXAMPLE CO., LTD." })}
        {field("addressTh", "ที่อยู่ (ไทย)", { required: true, wide: true, textarea: true })}
        {field("addressEn", "ที่อยู่ (อังกฤษ)", { wide: true, textarea: true })}
        {field("taxId", "เลขประจำตัวผู้เสียภาษี", { required: true, placeholder: "13 หลัก" })}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-700">สำนักงาน</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="branchType" value="head" checked={branchType === "head"} onChange={() => setBranchType("head")} />
              สำนักงานใหญ่
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="branchType" value="branch" checked={branchType === "branch"} onChange={() => setBranchType("branch")} />
              สาขา
            </label>
            {branchType === "branch" && (
              <input name="branchCode" inputMode="numeric" maxLength={5} placeholder="รหัสสาขา 5 หลัก" defaultValue={values.branchCode === "00000" ? "" : values.branchCode} aria-invalid={!!errors.branchCode} className={`${inputClass} w-40`} />
            )}
          </div>
          {errors.branchCode && <p className="text-sm text-red-600">{errors.branchCode}</p>}
        </div>
        {field("headerNote", "ข้อความใต้เลขผู้เสียภาษี", { placeholder: "เอกสารออกเป็นชุด" })}
      </Section>

      <Section title="ช่องทางติดต่อ">
        {field("phone", "โทรศัพท์")}
        {field("email", "อีเมล")}
        {field("lineId", "ID LINE")}
        {field("facebook", "Facebook")}
      </Section>

      <Section title="โลโก้">
        <div className="space-y-2 sm:col-span-2">
          {hasLogo && (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected API image */}
              <img src="/api/company/logo" alt="โลโก้ปัจจุบัน" className="h-20 w-20 rounded border border-slate-200 object-contain" />
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="removeLogo" /> ลบโลโก้
              </label>
            </div>
          )}
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="block text-sm" />
          {errors.logo ? <p className="text-sm text-red-600">{errors.logo}</p> : <p className="text-xs text-slate-500">PNG, JPG หรือ WebP ไม่เกิน 1 MB · ภาพสี่เหลี่ยมจัตุรัสจะดูดีที่สุด</p>}
        </div>
      </Section>

      <Section title="ใบกำกับภาษี">
        {field("vatRate", "อัตราภาษีมูลค่าเพิ่ม (%)", { required: true, hint: "ใช้กับใบที่ออกหลังจากนี้ ใบเดิมคงอัตราเดิม" })}
      </Section>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className={`${cardClass} p-5`}>
      <legend className="px-1 text-sm font-semibold text-slate-700">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
