"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { bahtText, computeTotals, lineAmount, fromHundredths } from "@/lib/invoice";
import { formatTaxId } from "@/lib/thai-tax-id";
import type { InvoiceFormState } from "@/server/invoices/actions";
import type { InvoiceFormValues } from "@/server/invoices/schema";

export type BuyerOption = {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  address: string | null;
  taxId: string | null;
  isHeadOffice: boolean;
  branchCode: string | null;
};

type Row = InvoiceFormValues["items"][number] & { key: number };

type Props = {
  action: (prev: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
  initial: InvoiceFormValues;
  buyers: BuyerOption[];
  /** Most recent number in use, as a hint for typing the next one */
  lastNumber: string | null;
  vatRate: string;
  maxItems: number;
  submitLabel: string;
  cancelHref: string;
};

const EMPTY_ROW = { description: "", quantity: "", unit: "", unitPrice: "", discount: "" };
let nextKey = 1;
const withKeys = (items: InvoiceFormValues["items"]): Row[] => items.map((i) => ({ ...i, key: nextKey++ }));
const isBlank = (r: Row) => [r.description, r.quantity, r.unit, r.unitPrice, r.discount].every((v) => v.trim() === "");

/** What a customer looks like on the invoice: company name if any, branch only for VAT registrants */
function buyerFields(b: BuyerOption) {
  return {
    buyerName: b.companyName || b.name,
    buyerBranch: b.taxId ? (b.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${b.branchCode}`) : "",
    buyerAddress: b.address ?? "",
    buyerTaxId: b.taxId ? formatTaxId(b.taxId) : "",
  };
}

export function InvoiceForm({ action, initial, buyers, lastNumber, vatRate, maxItems, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};

  return (
    // key: re-mount with the echoed values after a failed submit
    <InvoiceFormBody
      key={JSON.stringify(state.values ?? null)}
      formAction={formAction}
      pending={pending}
      values={values}
      errors={errors}
      buyers={buyers}
      lastNumber={lastNumber}
      vatRate={vatRate}
      maxItems={maxItems}
      submitLabel={submitLabel}
      cancelHref={cancelHref}
    />
  );
}

function InvoiceFormBody({
  formAction,
  pending,
  values,
  errors,
  buyers,
  lastNumber,
  vatRate,
  maxItems,
  submitLabel,
  cancelHref,
}: Omit<Props, "action" | "initial"> & {
  formAction: (formData: FormData) => void;
  pending: boolean;
  values: InvoiceFormValues;
  errors: Partial<Record<string, string>>;
}) {
  const [fields, setFields] = useState(values.fields);
  const [rows, setRows] = useState<Row[]>(() => withKeys(values.items.length ? values.items : [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]));

  const set = (name: string, value: string) => setFields((f) => ({ ...f, [name]: value }));
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const filled = rows.filter((r) => !isBlank(r));
  const totals = filled.length ? computeTotals(filled, vatRate) : null;

  const chooseBuyer = (id: string) => {
    const b = buyers.find((x) => x.id === id);
    setFields((f) => ({ ...f, customerId: id, ...(b && buyerFields(b)) }));
  };

  const input = (name: string, opts: { type?: string; placeholder?: string } = {}) => (
    <input
      id={name}
      name={name}
      type={opts.type ?? "text"}
      placeholder={opts.placeholder}
      value={fields[name] ?? ""}
      onChange={(e) => set(name, e.target.value)}
      aria-invalid={!!errors[name]}
      className={inputClass}
    />
  );

  // Errors for item rows are keyed by position among the non-blank rows
  const filledIndex = new Map(filled.map((r, i) => [r.key, i]));
  const rowError = (r: Row, field: string) => {
    const i = filledIndex.get(r.key);
    return i === undefined ? undefined : errors[`items.${i}.${field}`];
  };

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* Only non-blank rows are sent, so server error indexes line up with `filled` */}
      <input type="hidden" name="items" value={JSON.stringify(filled.map(({ key, ...r }) => (void key, r)))} />
      {errors.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <fieldset className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
          <legend className="px-1 text-sm font-semibold text-slate-700">ลูกค้า</legend>
          <div className="sm:col-span-2">
            <Field label="เลือกจากรายชื่อลูกค้า" htmlFor="customerId" error={errors.customerId} required>
              <select id="customerId" name="customerId" value={fields.customerId ?? ""} onChange={(e) => chooseBuyer(e.target.value)} aria-invalid={!!errors.customerId} className={inputClass}>
                <option value="">— เลือกลูกค้า —</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.companyName || b.name} ({b.code})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="ชื่อลูกค้าบนใบกำกับ" htmlFor="buyerName" error={errors.buyerName} required>
            {input("buyerName")}
          </Field>
          <Field label="สำนักงานใหญ่ / สาขา" htmlFor="buyerBranch" error={errors.buyerBranch} hint="แสดงต่อท้ายชื่อ เว้นว่างได้">
            {input("buyerBranch", { placeholder: "สำนักงานใหญ่" })}
          </Field>
          <div className="sm:col-span-2">
            <Field label="ที่อยู่" htmlFor="buyerAddress" error={errors.buyerAddress}>
              <textarea id="buyerAddress" name="buyerAddress" rows={2} value={fields.buyerAddress ?? ""} onChange={(e) => set("buyerAddress", e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="เลขประจำตัวผู้เสียภาษี" htmlFor="buyerTaxId" error={errors.buyerTaxId}>
            {input("buyerTaxId", { placeholder: "0-0000-00000-00-0" })}
          </Field>
          <Field label="หมายเหตุ" htmlFor="remark" error={errors.remark}>
            {input("remark")}
          </Field>
        </fieldset>

        <fieldset className={`${cardClass} grid gap-4 p-5`}>
          <legend className="px-1 text-sm font-semibold text-slate-700">เอกสาร</legend>
          <Field
            label="เลขที่ใบกำกับ"
            htmlFor="number"
            error={errors.number}
            hint={lastNumber ? `เลขที่ล่าสุดที่ใช้ไป: ${lastNumber}` : "ยังไม่เคยออกใบกำกับ"}
            required
          >
            {input("number", { placeholder: "IN1026-0001" })}
          </Field>
          <Field label="วันที่" htmlFor="issueDate" error={errors.issueDate} required>
            {input("issueDate", { type: "date" })}
          </Field>
          <Field label="พนักงานขาย" htmlFor="salesperson" error={errors.salesperson}>
            {input("salesperson")}
          </Field>
          <Field label="กำหนดชำระเงิน" htmlFor="paymentTerm" error={errors.paymentTerm}>
            {input("paymentTerm", { placeholder: "เงินสด / เครดิต 30 วัน" })}
          </Field>
          <Field label="ครบกำหนด" htmlFor="dueDate" error={errors.dueDate}>
            {input("dueDate", { type: "date" })}
          </Field>
        </fieldset>
      </div>

      <fieldset className={`${cardClass} p-5`}>
        <legend className="px-1 text-sm font-semibold text-slate-700">รายการสินค้า</legend>
        {errors.items && <p className="mb-3 text-sm text-red-600">{errors.items}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="w-10 px-1 py-2 font-medium">ลำดับ</th>
                <th className="px-1 py-2 font-medium">รายละเอียด</th>
                <th className="w-24 px-1 py-2 font-medium">จำนวน</th>
                <th className="w-20 px-1 py-2 font-medium">หน่วย</th>
                <th className="w-32 px-1 py-2 font-medium">ราคาต่อหน่วย</th>
                <th className="w-28 px-1 py-2 font-medium">ส่วนลด</th>
                <th className="w-32 px-1 py-2 text-right font-medium">จำนวนเงิน</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const amount = isBlank(r) ? null : lineAmount(r);
                const cell = (field: "description" | "quantity" | "unit" | "unitPrice" | "discount", opts: { mode?: "decimal"; placeholder?: string } = {}) => {
                  const err = rowError(r, field);
                  return (
                    <td className="px-1 py-1 align-top">
                      <input
                        aria-label={`${field} แถว ${i + 1}`}
                        inputMode={opts.mode}
                        placeholder={opts.placeholder}
                        value={r[field]}
                        onChange={(e) => setRow(r.key, { [field]: e.target.value })}
                        aria-invalid={!!err}
                        title={err}
                        className={`${inputClass} px-2 py-1.5 ${opts.mode ? "text-right tabular-nums" : ""}`}
                      />
                      {err && <p className="mt-0.5 text-xs text-red-600">{err}</p>}
                    </td>
                  );
                };
                return (
                  <tr key={r.key}>
                    <td className="px-1 py-1 pt-2.5 align-top text-slate-500">{i + 1}</td>
                    {cell("description")}
                    {cell("quantity", { mode: "decimal" })}
                    {cell("unit", { placeholder: "ตัว" })}
                    {cell("unitPrice", { mode: "decimal" })}
                    {cell("discount", { mode: "decimal" })}
                    <td className="px-1 py-1 pt-2.5 text-right align-top tabular-nums">
                      {amount === null ? "" : amount < 0n ? <span className="text-red-600">ส่วนลดเกิน</span> : formatMoney(fromHundredths(amount))}
                    </td>
                    <td className="px-1 py-1 align-top">
                      <button
                        type="button"
                        aria-label={`ลบแถว ${i + 1}`}
                        onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                        className="rounded px-2 py-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length < maxItems && (
          <button type="button" onClick={() => setRows((rs) => [...rs, ...withKeys([EMPTY_ROW])])} className="mt-2 text-sm text-blue-700 hover:underline">
            + เพิ่มแถว
          </button>
        )}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">{totals ? `(${bahtText(totals.total)})` : ""}</p>
          <dl className="grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-slate-500">รวมเงิน</dt>
            <dd className="text-right tabular-nums">{totals ? formatMoney(totals.subtotal) : "–"}</dd>
            <dt className="text-slate-500">ภาษีมูลค่าเพิ่ม {vatRate}%</dt>
            <dd className="text-right tabular-nums">{totals ? formatMoney(totals.vatAmount) : "–"}</dd>
            <dt className="font-semibold">ยอดเงินสุทธิ</dt>
            <dd className="text-right font-semibold tabular-nums">{totals ? formatMoney(totals.total) : "–"}</dd>
          </dl>
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
