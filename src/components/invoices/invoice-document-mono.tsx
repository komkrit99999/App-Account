import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { bahtText } from "@/lib/invoice";
import { formatTaxId } from "@/lib/thai-tax-id";
import type { InvoiceDTO } from "@/server/invoices/queries";

// Printable A4 tax invoice — black-and-white layout with rounded boxes: title and
// No./Date box on the right, customer code, buyer box with branch code, a row
// for order no./terms/due date/sales staff, an item table with a per-line
// discount column, totals and amount in words, and three signature boxes.

const thaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const MIN_ROWS = 13;

export function InvoiceDocumentMono({ invoice, copy, logoUrl }: { invoice: InvoiceDTO; copy: boolean; logoUrl: string | null }) {
  const s = invoice.seller;
  const fillerRows = Math.max(0, MIN_ROWS - invoice.items.length);
  const notes = (s.footerNotes ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const office = s.isHeadOffice ? ["สำนักงานใหญ่", "Head Office"] : [`สาขา ${s.branchCode}`, `Branch ${s.branchCode}`];
  const contact = [s.phone && `โทร. ${s.phone}`, s.email && `E-Mail : ${s.email}`].filter(Boolean).join("  ");
  const line = [s.lineId && `ID Line : ${s.lineId}`, s.lineOfficial && `Line Official : ${s.lineOfficial}`, s.facebook && `Facebook : ${s.facebook}`].filter(Boolean).join("  ");

  return (
    <article className="relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[8mm] text-[12px] leading-snug text-slate-900 shadow-sm ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {invoice.status === "CANCELLED" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="-rotate-30 rounded-xl border-8 border-red-500/40 px-10 py-4 text-8xl font-bold text-red-500/40">ยกเลิก</span>
        </div>
      )}

      {/* Seller + title */}
      <header className="flex items-start gap-3">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- auth-protected API image
          <img src={logoUrl} alt="" className="h-[20mm] w-[20mm] shrink-0 object-contain" />
        )}
        <div className="min-w-0 flex-1 text-[11px]">
          <p className="text-[18px] font-bold leading-tight">
            {s.nameTh} ({office[0]})
          </p>
          {s.nameEn && (
            <p className="text-[16px] leading-tight">
              {s.nameEn} ({office[1]})
            </p>
          )}
          <p className="mt-1">{s.addressTh}</p>
          {contact && <p>{contact}</p>}
          {line && <p>{line}</p>}
          <p>เลขประจำตัวผู้เสียภาษี {s.taxId}</p>
        </div>
        <div className="w-[58mm] shrink-0 text-center">
          <p className="text-[17px] leading-tight">{copy ? "สำเนาใบกำกับภาษี" : "ต้นฉบับใบกำกับภาษี"}</p>
          <p className="text-[16px] leading-tight tracking-wide">{copy ? "COPY TAX INVOICE" : "ORIGINAL TAX INVOICE"}</p>
          {s.headerNote && <p className="text-[15px] leading-tight">{s.headerNote}</p>}
          <div className="mt-2 rounded-lg border border-slate-800 px-3 py-1.5 text-left">
            <Pair th="เลขที่" en="No">
              {invoice.number}
            </Pair>
            <Pair th="วันที่" en="Date">
              {thaiDate.format(invoice.issueDate)}
            </Pair>
          </div>
        </div>
      </header>

      <div className="mt-1 flex items-end gap-6 pl-2">
        <span className="leading-tight">
          <span className="block">รหัสลูกค้า</span>
          <span className="block text-[10.5px]">Customer&apos;s Code</span>
        </span>
        <span className="font-serif">{invoice.customerCode}</span>
      </div>

      {/* Buyer */}
      <section className="mt-1 grid grid-cols-[1fr_58mm] gap-1.5">
        <div className="space-y-1.5 rounded-lg border border-slate-800 p-2.5">
          <Row th="นามผู้ซื้อ" en="Customer's Name">
            {invoice.buyerName}
            {invoice.buyerBranch && ` (${invoice.buyerBranch})`}
          </Row>
          <Row th="ที่อยู่" en="Address">
            <span className="whitespace-pre-line">{invoice.buyerAddress}</span>
          </Row>
          {invoice.buyerTaxId && <p className="pl-[32mm] pt-1 font-serif font-semibold">เลขประจำตัวผู้เสียภาษี {formatTaxId(invoice.buyerTaxId)}</p>}
        </div>
        <div className="rounded-lg border border-slate-800 p-2.5">
          <span className="block leading-tight">รหัสสาขา</span>
          <span className="block text-[10.5px] leading-tight">Branch Code</span>
          <p className="mt-1 font-serif">{invoice.buyerBranch}</p>
        </div>
      </section>

      {/* Order details */}
      <section className="mt-1.5 grid grid-cols-4 overflow-hidden rounded-lg border border-slate-800 text-center">
        {[
          ["เลขที่ใบสั่งซื้อ", "Order No", invoice.purchaseOrderNo],
          ["เงื่อนไขการชำระเงิน", "Term of Payment", invoice.paymentTerm],
          ["กำหนดชำระ", "Due Date", invoice.dueDate && thaiDate.format(invoice.dueDate)],
          ["พนักงานขาย", "Sales Staff", invoice.salesperson],
        ].map(([th, en, value], i) => (
          <div key={String(en)} className={i < 3 ? "border-r border-slate-800" : ""}>
            <div className="border-b border-slate-800 py-1 leading-tight">
              <span className="block">{th}</span>
              <span className="block text-[10px]">{en}</span>
            </div>
            <p className="min-h-[7mm] py-1 font-serif font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {/* Items, totals and amount in words */}
      <section className="mt-1.5 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-800">
              <Th className="w-[12mm]" th="ลำดับ" en="No." />
              <Th th="รายละเอียดสินค้า" en="DESCRIPTION" />
              <Th className="w-[24mm]" th="จำนวน" en="QUANTITY" />
              <Th className="w-[19mm]" th="หน่วยละ" en="UNIT" />
              <Th className="w-[19mm]" th="ส่วนลด" en="DISCOUNT" />
              <Th className="w-[27mm]" th="จำนวนเงิน" en="AMOUNT" last />
            </tr>
          </thead>
          <tbody className="font-serif [&_td]:border-r [&_td]:border-slate-800 [&_td:last-child]:border-r-0 [&_td]:px-2 [&_td]:py-[3px]">
            {invoice.items.map((item, i) => (
              <tr key={item.id} className="align-top">
                <td className="text-center">{i + 1}</td>
                <td className="pl-4">{item.description}</td>
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
        </table>

        <div className="grid grid-cols-[1fr_auto] border-t border-slate-800">
          <ol className="list-decimal space-y-0.5 py-1.5 pl-7 pr-2 text-[10px]">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
          <div className="grid w-[73mm] grid-cols-[1fr_auto] gap-x-2 border-l border-slate-800 px-2 py-1 font-serif">
            <Total th="รวมเงิน" en="SUBTOTAL" value={formatMoney(invoice.subtotal)} />
            <Total th={`ภาษีมูลค่าเพิ่ม ${invoice.vatRate} %`} en="VAT" value={formatMoney(invoice.vatAmount)} />
            <Total th="ยอดเงินสุทธิ" en="NET TOTAL" value={formatMoney(invoice.total)} strong />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_73mm] border-t border-slate-800">
          <p className="flex items-center gap-6 px-2.5 py-1.5">
            <span className="shrink-0">จำนวนเงินเป็นตัวอักษร</span>
            <span className="font-serif text-[13px] font-semibold">{bahtText(invoice.total)}</span>
          </p>
          <span className="border-l border-slate-800" />
        </div>
      </section>

      {/* Signatures */}
      <section className="mt-2 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-800 font-serif">
        {[
          ["ผู้รับของ", "RECEIVER", true],
          ["ผู้ส่งของ/พนักงานบัญชี", "DELIVERY/ACCOUNTANT", true],
          ["ผู้รับมอบอำนาจ", "Authorizer Signature", false],
        ].map(([th, en, dated], i) => (
          <div key={String(en)} className={`flex h-[34mm] flex-col justify-end px-3 pb-1.5 text-center ${i < 2 ? "border-r border-slate-800" : ""}`}>
            <div className="mx-6 border-b border-slate-700" />
            <p className="mt-0.5">{th}</p>
            <p className="font-semibold">{en}</p>
            <p className="mt-0.5 text-left">{dated ? "วันที่............/............/............" : " "}</p>
          </div>
        ))}
      </section>
    </article>
  );
}

function Pair({ th, en, children }: { th: string; en: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[12mm_1fr] items-center">
      <span className="leading-tight">
        <span className="block">{th}</span>
        <span className="block text-[10px]">{en}</span>
      </span>
      <span className="text-center font-serif font-semibold">{children}</span>
    </div>
  );
}

function Row({ th, en, children }: { th: string; en: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[30mm_1fr] items-start gap-2">
      <span className="leading-tight">
        <span className="block">{th}</span>
        <span className="block text-[10.5px]">{en}</span>
      </span>
      <div className="pt-0.5 font-serif font-semibold">{children}</div>
    </div>
  );
}

function Th({ th, en, className = "", last }: { th: string; en: string; className?: string; last?: boolean }) {
  return (
    <th className={`px-2 py-1 text-center font-normal leading-tight ${last ? "" : "border-r border-slate-800"} ${className}`}>
      <span className="block">{th}</span>
      <span className="block text-[10px]">{en}</span>
    </th>
  );
}

function Total({ th, en, value, strong }: { th: string; en: string; value: string; strong?: boolean }) {
  return (
    <>
      <span className="font-sans leading-tight">
        <span className="block">{th}</span>
        <span className="block text-[10px]">{en}</span>
      </span>
      <span className={`self-end text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</span>
    </>
  );
}
