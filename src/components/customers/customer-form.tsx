"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { useCan } from "@/components/permissions-provider";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";
import { tagColorClass } from "@/lib/tag-colors";
import type { CustomerFormState } from "@/server/customers/actions";
import type { CustomerFormValues } from "@/server/customers/schema";
import type { CustomerTagDTO } from "@/server/customers/queries";

type Props = {
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  initial: CustomerFormValues;
  tags: CustomerTagDTO[];
  submitLabel: string;
  cancelHref: string;
};

export function CustomerForm({ action, initial, tags, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const canEditFinancial = useCan("editFinancial");

  // After a failed submit, show what the user typed rather than the original values
  const { fields: values, tagIds } = state.values ?? initial;
  const errors = state.errors ?? {};
  const [branchType, setBranchType] = useState(values.branchType ?? "head");
  const selectedTags = new Set(tagIds);

  const field = (name: string, label: string, opts: { type?: string; required?: boolean; inputMode?: "numeric" | "decimal"; placeholder?: string } = {}) => (
    <Field label={label} error={errors[name]} htmlFor={name} required={opts.required}>
      <input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        defaultValue={values[name] ?? ""}
        aria-invalid={!!errors[name]}
        className={inputClass}
      />
    </Field>
  );

  return (
    // key forces inputs to pick up echoed values after a failed submit
    <form action={formAction} key={JSON.stringify(state.values ?? null)} className="space-y-6" noValidate>
      {errors.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>}

      <Section title="ข้อมูลพื้นฐาน">
        <div className="sm:col-span-2">{field("name", "ชื่อลูกค้า", { required: true })}</div>
        {field("phone", "เบอร์โทร", { type: "tel", placeholder: "081-234-5678" })}
        {field("email", "อีเมล", { type: "email" })}
        <div className="sm:col-span-2">
          <Field label="ที่อยู่" htmlFor="address" error={errors.address}>
            <textarea id="address" name="address" rows={2} defaultValue={values.address ?? ""} className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ" htmlFor="note" error={errors.note}>
            <textarea id="note" name="note" rows={2} defaultValue={values.note ?? ""} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="ช่องทางติดต่อ / ที่ทำงาน">
        {field("facebook", "Facebook")}
        {field("lineId", "ID LINE")}
        {field("workplace", "ที่ทำงาน")}
        {field("workplacePhone", "เบอร์ที่ทำงาน", { type: "tel", placeholder: "02-035-1400 ต่อ 409" })}
      </Section>

      <Section title="ข้อมูลภาษี / บริษัท">
        {field("companyName", "ชื่อบริษัท")}
        {field("contactPerson", "ผู้ติดต่อ")}
        {field("taxId", "เลขประจำตัวผู้เสียภาษี (13 หลัก)", { inputMode: "numeric", placeholder: "0-0000-00000-00-0" })}
        <Field label="สำนักงาน" error={errors.branchCode} htmlFor="branchCode">
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
              <input
                id="branchCode"
                name="branchCode"
                inputMode="numeric"
                maxLength={5}
                placeholder="รหัสสาขา 5 หลัก"
                defaultValue={values.branchCode === "00000" ? "" : (values.branchCode ?? "")}
                aria-invalid={!!errors.branchCode}
                className={`${inputClass} w-40`}
              />
            )}
          </div>
        </Field>
      </Section>

      {canEditFinancial && (
        <Section title="ข้อมูลการเงิน">
          {field("creditLimit", "วงเงินเครดิต (บาท)", { inputMode: "decimal", placeholder: "0.00" })}
          {field("paymentTermDays", "เงื่อนไขชำระเงิน (วัน)", { inputMode: "numeric", placeholder: "30" })}
          {field("outstandingBalance", "ยอดค้างชำระ (บาท)", { inputMode: "decimal", placeholder: "0.00" })}
        </Section>
      )}

      <Section title="แท็ก">
        <div className="sm:col-span-2">
          {tags.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีแท็กในระบบ</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <label key={tag.id} className="cursor-pointer">
                  <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selectedTags.has(tag.id)} className="peer sr-only" />
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm ring-1 ring-inset opacity-50 peer-checked:opacity-100 peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-blue-500 ${tagColorClass(tag.color)}`}
                  >
                    {tag.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.tagIds && <p className="mt-1 text-sm text-red-600">{errors.tagIds}</p>}
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonSecondary}>
          ยกเลิก
        </Link>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "กำลังบันทึก…" : submitLabel}
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

function Field({ label, htmlFor, error, required, children }: { label: string; htmlFor: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
