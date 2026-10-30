"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { MAX_INTEREST_RATE_PER_YEAR, monthlyInterest } from "@/lib/loan";
import type { LoanFormState } from "@/server/loans/actions";
import type { LoanFormValues } from "@/server/loans/schema";

type Props = {
  action: (prev: LoanFormState, formData: FormData) => Promise<LoanFormState>;
  initial: LoanFormValues;
  /** null = borrower is fixed (shown as text) */
  borrowers: { id: string; code: string; name: string }[] | null;
  borrowerLabel?: string;
  submitLabel: string;
  cancelHref: string;
};

export function LoanForm({ action, initial, borrowers, borrowerLabel, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [principal, setPrincipal] = useState(values.principal ?? "");
  const [rate, setRate] = useState(values.interestRatePerYear ?? "");

  const p = Number(principal.replace(/,/g, ""));
  const r = Number(rate);
  const preview = p > 0 && r >= 0 && r <= MAX_INTEREST_RATE_PER_YEAR ? monthlyInterest(p, r) : null;

  const input = (name: string, opts: { type?: string; inputMode?: "numeric" | "decimal"; placeholder?: string } = {}) => (
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
  );

  return (
    <form action={formAction} key={JSON.stringify(state.values ?? null)} className="space-y-6" noValidate>
      {errors.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>}

      <fieldset className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
        <legend className="px-1 text-sm font-semibold text-slate-700">สัญญาเงินกู้</legend>

        <div className="sm:col-span-2">
          <Field label="ชื่อผู้กู้" htmlFor="customerId" error={errors.customerId} required>
            {borrowers ? (
              <select id="customerId" name="customerId" defaultValue={values.customerId ?? ""} aria-invalid={!!errors.customerId} className={inputClass}>
                <option value="">— เลือกลูกค้า —</option>
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="customerId" value={values.customerId} />
                <p className="py-2 text-sm font-medium">{borrowerLabel}</p>
              </>
            )}
          </Field>
        </div>

        <Field label="เงินต้น (บาท)" htmlFor="principal" error={errors.principal} required>
          <input
            id="principal"
            name="principal"
            inputMode="decimal"
            placeholder="5000"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            aria-invalid={!!errors.principal}
            className={inputClass}
          />
        </Field>

        <Field
          label="อัตราดอกเบี้ย (ร้อยละต่อปี)"
          htmlFor="interestRatePerYear"
          error={errors.interestRatePerYear}
          hint={`สูงสุดร้อยละ ${MAX_INTEREST_RATE_PER_YEAR} ต่อปีตามกฎหมาย`}
          required
        >
          <input
            id="interestRatePerYear"
            name="interestRatePerYear"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_INTEREST_RATE_PER_YEAR}
            step="0.01"
            placeholder={String(MAX_INTEREST_RATE_PER_YEAR)}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            aria-invalid={!!errors.interestRatePerYear}
            className={inputClass}
          />
        </Field>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
          ดอกเบี้ยต่อเดือน:{" "}
          <span className="font-semibold text-slate-900 tabular-nums">{preview === null ? "–" : `${formatMoney(String(preview))} บาท`}</span>
          {r > MAX_INTEREST_RATE_PER_YEAR && <span className="ml-2 text-red-600">เกินอัตราที่กฎหมายกำหนด</span>}
        </div>

        <Field label="ส่งดอกทุกวันที่" htmlFor="interestDueDay" error={errors.interestDueDay} hint="1–31 (31 = สิ้นเดือน)" required>
          {input("interestDueDay", { inputMode: "numeric", placeholder: "30" })}
        </Field>
        <Field label="วันที่ปล่อยกู้" htmlFor="startDate" error={errors.startDate} required>
          {input("startDate", { type: "date" })}
        </Field>
        <Field label="กำหนดคืนเงินต้น" htmlFor="principalDueDate" error={errors.principalDueDate} hint="เว้นว่าง = ไม่มีกำหนด">
          {input("principalDueDate", { type: "date" })}
        </Field>

        <div className="sm:col-span-2">
          <Field label="หมายเหตุ" htmlFor="note" error={errors.note}>
            <textarea id="note" name="note" rows={2} defaultValue={values.note ?? ""} className={inputClass} />
          </Field>
        </div>
      </fieldset>

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

function Field({ label, htmlFor, error, hint, required, children }: { label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
