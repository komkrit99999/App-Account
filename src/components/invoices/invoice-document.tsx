import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { bahtText } from "@/lib/invoice";
import { formatTaxId } from "@/lib/thai-tax-id";
import type { InvoiceDTO } from "@/server/invoices/queries";

// Printable A4 tax invoice, laid out like the pre-printed paper form.

const shortDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "UTC" });
const BROWN = "bg-[#7a2e1f] text-white";
const PEACH = "bg-[#f4dccf]";
const MIN_ROWS = 12;

export function InvoiceDocument({ invoice, copy, hasLogo }: { invoice: InvoiceDTO; copy: boolean; hasLogo: boolean }) {
  const s = invoice.seller;
  const fillerRows = Math.max(0, MIN_ROWS - invoice.items.length);
  const contacts = [
    s.phone && `Tel. ${s.phone}`,
    s.lineId && `ID.Line : ${s.lineId}`,
    s.email && `E-mail : ${s.email}`,
    s.facebook && `Facebook : ${s.facebook}`,
  ].filter(Boolean);

  return (
    <article className="relative mx-auto w-full max-w-[210mm] bg-white p-[10mm] text-[13px] leading-snug text-slate-900 shadow-sm ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {invoice.status === "CANCELLED" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-30 rounded-xl border-8 border-red-500/40 px-10 py-4 text-8xl font-bold text-red-500/40">ยกเลิก</span>
        </div>
      )}

      {/* Seller */}
      <header className="flex gap-4">
        {hasLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- auth-protected API image, no optimisation wanted
          <img src="/api/company/logo" alt="" className="h-24 w-24 shrink-0 object-contain" />
        )}
        <div className="flex-1">
          <p className="text-lg font-bold text-[#7a2e1f]">
            {s.nameTh} ({s.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${s.branchCode}`})
          </p>
          {s.nameEn && <p className="text-base font-bold text-[#7a2e1f]">{s.nameEn}</p>}
          <p className="text-xs">{s.addressTh}</p>
          {s.addressEn && <p className="text-xs">{s.addressEn}</p>}
          {contacts.length > 0 && <p className="text-xs font-medium">{contacts.join("  ")}</p>}
        </div>
        <div className="self-end text-right text-xs">
          <p className="font-semibold">เลขประจำตัวผู้เสียภาษี {s.taxId}</p>
          {s.headerNote && <p className="text-slate-600">{s.headerNote}</p>}
        </div>
      </header>

      <h1 className="mt-4 text-center">
        <span className="block text-lg font-bold">{copy ? "สำเนาใบกำกับภาษี" : "ต้นฉบับใบกำกับภาษี"}</span>
        <span className="block text-sm font-semibold tracking-wide">{copy ? "COPY TAX INVOICE" : "ORIGINAL TAX INVOICE"}</span>
      </h1>

      {/* Buyer + document info */}
      <section className="mt-3 grid grid-cols-[3fr_2fr] gap-3">
        <div className="space-y-2 rounded border border-slate-500 p-3">
          <Line th="นามลูกค้า" en="Name">
            {invoice.buyerName}
            {invoice.buyerBranch && ` (${invoice.buyerBranch})`}
          </Line>
          <Line th="ที่อยู่" en="Address">
            <span className="whitespace-pre-line">{invoice.buyerAddress}</span>
            {invoice.buyerTaxId && <span className="mt-1 block">เลขประจำตัวผู้เสียภาษี&nbsp;&nbsp;{formatTaxId(invoice.buyerTaxId)}</span>}
          </Line>
          <Line th="หมายเหตุ" en="Remark">
            {invoice.remark}
          </Line>
        </div>
        <div className="space-y-1.5 rounded border border-slate-500 p-3">
          <Line th="วันที่" en="Date">{shortDate.format(invoice.issueDate)}</Line>
          <Line th="เลขที่ใบกำกับ" en="Invoice No.">{invoice.number}</Line>
          <Line th="พนักงานขาย" en="Salesman">{invoice.salesperson}</Line>
          <Line th="กำหนดชำระเงิน" en="Term">{invoice.paymentTerm}</Line>
          <Line th="ครบกำหนด" en="Due Date">{invoice.dueDate && shortDate.format(invoice.dueDate)}</Line>
        </div>
      </section>

      {/* Items */}
      <table className="mt-3 w-full border-collapse border border-slate-500 text-[12px] [print-color-adjust:exact]">
        <thead className={BROWN}>
          <tr>
            <Th className="w-12" th="ลำดับ" en="No" />
            <Th th="รายละเอียด" en="Description" />
            <Th className="w-24" th="จำนวน" en="Quantity" />
            <Th className="w-24" th="หน่วยละ" en="Unit" />
            <Th className="w-20" th="ส่วนลด" en="Discount" />
            <Th className="w-28" th="จำนวนเงิน" en="Amount" />
          </tr>
        </thead>
        <tbody className="[&_td]:border-x [&_td]:border-slate-500 [&_td]:px-2 [&_td]:py-1">
          {invoice.items.map((item, i) => (
            <tr key={item.id} className="align-top">
              <td className="text-center">{i + 1}</td>
              <td>{item.description}</td>
              <td className="whitespace-nowrap text-center tabular-nums">
                {Number(item.quantity).toLocaleString("th-TH")} {item.unit}
              </td>
              <td className="text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
              <td className="text-right tabular-nums">{Number(item.discount) > 0 ? formatMoney(item.discount) : ""}</td>
              <td className="text-right tabular-nums">{formatMoney(item.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: fillerRows }, (_, i) => (
            <tr key={`blank-${i}`} aria-hidden>
              {Array.from({ length: 6 }, (_, c) => (
                <td key={c}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-500">
          <tr>
            <td colSpan={3} rowSpan={3} className="px-3 py-2 align-top text-center font-medium">
              {bahtText(invoice.total)}
            </td>
            <TotalLabel th="รวมเงิน" en="Sub Total" />
            <td className="border border-slate-500 px-2 text-right tabular-nums">{formatMoney(invoice.subtotal)}</td>
          </tr>
          <tr>
            <TotalLabel th={`ภาษีมูลค่าเพิ่ม ${invoice.vatRate} %`} en="VAT" />
            <td className="border border-slate-500 px-2 text-right tabular-nums">{formatMoney(invoice.vatAmount)}</td>
          </tr>
          <tr>
            <TotalLabel th="ยอดเงินสุทธิ" en="Net Total" />
            <td className="border border-slate-500 px-2 text-right font-semibold tabular-nums">{formatMoney(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Payment */}
      <section className="mt-3 space-y-1 text-[12px]">
        <p className="font-semibold">ชำระเงินโดย :</p>
        <p className="pl-4">(&nbsp;&nbsp;&nbsp;) เงินสด</p>
        <p className="pl-4">(&nbsp;&nbsp;&nbsp;) เช็คธนาคาร..................................สาขา..........................เลขที่..........................ลงวันที่..........................</p>
        <p className="font-medium">(ในกรณีชำระเงินด้วยเช็ค โปรดสั่งจ่ายและขีดคร่อมในนาม {s.nameTh} เท่านั้น)</p>
      </section>

      {/* Signatures */}
      <section className="mt-4 grid grid-cols-3 gap-4 text-[12px] [print-color-adjust:exact]">
        {[
          ["ผู้รับของ", "Receiver"],
          ["ผู้ส่งของ", "Delivered By"],
          ["ผู้รับเงิน", "Collector"],
        ].map(([th, en]) => (
          <div key={en} className={`flex h-28 flex-col justify-between rounded-lg border border-slate-500 p-2 text-center ${PEACH}`}>
            <p className="font-semibold">
              {th} / {en}
            </p>
            <p className="text-left">วันที่ / Date.........................................</p>
          </div>
        ))}
      </section>
    </article>
  );
}

function Line({ th, en, children }: { th: string; en: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <div className="leading-tight">
        <span className="block font-semibold">{th}</span>
        <span className="block text-[10px] text-slate-500">{en}</span>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function Th({ th, en, className = "" }: { th: string; en: string; className?: string }) {
  return (
    <th className={`border border-slate-500 px-2 py-1 text-center font-semibold leading-tight ${className}`}>
      <span className="block">{th}</span>
      <span className="block text-[10px] font-normal opacity-80">{en}</span>
    </th>
  );
}

function TotalLabel({ th, en }: { th: string; en: string }) {
  return (
    <td colSpan={2} className="border border-slate-500 px-2 py-1 leading-tight">
      <span className="block font-semibold">{th}</span>
      <span className="block text-[10px]">{en}</span>
    </td>
  );
}
