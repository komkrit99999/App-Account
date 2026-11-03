import type { CSSProperties, ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { bahtText, fromHundredths, lineAmount, toHundredths } from "@/lib/invoice";
import { formatTaxId } from "@/lib/thai-tax-id";
import type { InvoiceDTO } from "@/server/invoices/queries";

// Printable A4 tax invoice — red layout: red title tab, boxed customer/document
// details, red-headed item table, boxed totals with special discount, terms,
// three signature boxes and a red footer band.
//
// This layout has no per-line discount column, so lines show quantity × price and
// the line discounts are summed into "หักส่วนลดพิเศษ". The totals are the same
// numbers as the stored invoice: Sub Total − discount = stored subtotal.

const RED = "#d2333d";
const longDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const MIN_ROWS = 14;

export function InvoiceDocumentRed({ invoice, copy, logoUrl }: { invoice: InvoiceDTO; copy: boolean; logoUrl: string | null }) {
  const s = invoice.seller;
  const fillerRows = Math.max(0, MIN_ROWS - invoice.items.length);

  const gross = invoice.items.map((i) => lineAmount({ quantity: i.quantity, unitPrice: i.unitPrice, discount: "" }) ?? 0n);
  const discount = invoice.items.reduce((sum, i) => sum + (toHundredths(i.discount) ?? 0n), 0n);
  const subTotal = gross.reduce((sum, a) => sum + a, 0n);
  const notes = (s.footerNotes ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const lineContacts = [s.lineId && `Line ID : ${s.lineId}`, s.lineOfficial && `Line Official : ${s.lineOfficial}`].filter(Boolean);

  return (
    <article
      style={{ "--red": RED } as CSSProperties}
      className="relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[8mm] text-[12px] leading-snug text-slate-900 shadow-sm ring-1 ring-slate-200 [print-color-adjust:exact] print:max-w-none print:p-0 print:shadow-none print:ring-0"
    >
      {invoice.status === "CANCELLED" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="-rotate-30 rounded-xl border-8 border-red-500/40 px-10 py-4 text-8xl font-bold text-red-500/40">ยกเลิก</span>
        </div>
      )}

      {/* Seller + title */}
      <header className="mb-2 flex items-start gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- auth-protected API image
          <img src={logoUrl} alt="" className="h-[30mm] w-[30mm] shrink-0 rounded-full object-contain" />
        )}
        <div className="min-w-0 flex-1 pt-1 text-[11px] text-slate-700">
          <p className="text-[19px] font-bold leading-tight text-[var(--red)]">{s.nameTh}</p>
          <p>
            {s.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${s.branchCode}`} : {s.addressTh}
          </p>
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              {s.phone && <p>เบอร์โทร : {s.phone}</p>}
              {lineContacts.length > 0 && <p>{lineContacts.join("   ")}</p>}
              {s.facebook && <p>FB : {s.facebook}</p>}
              {s.email && <p>E-mail : {s.email}</p>}
              <p>เลขประจำตัวผู้เสียภาษีอากร {s.taxId}</p>
              {s.headerNote && <p className="text-slate-500">{s.headerNote}</p>}
            </div>
            <div className="flex shrink-0">
              <div className="flex min-w-[60mm] flex-col items-center justify-center bg-[var(--red)] px-5 py-1.5 text-white">
                <span className="text-[17px] font-semibold tracking-wide">Tax Invoice/Invoice</span>
                <span className="text-[14px]">ใบกำกับภาษี</span>
              </div>
              <div className="flex min-w-[28mm] flex-col items-center justify-center border-2 border-l-0 border-slate-800 px-3 py-1 font-bold text-slate-900">
                <span className="text-[16px]">{copy ? "สำเนา" : "ต้นฉบับ"}</span>
                <span className="text-[15px]">{copy ? "COPY" : "ORIGINAL"}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Customer + document */}
      <section className="grid grid-cols-[1fr_1fr] border border-[var(--red)]">
        <div className="space-y-2 border-r border-[var(--red)] p-2.5">
          <Row th="ชื่อลูกค้า" en="Customer Name">
            {invoice.buyerName}
            {invoice.buyerBranch && ` (${invoice.buyerBranch})`}
          </Row>
          <Row th="เลขที่ผู้เสียภาษี" en="Tax ID">
            {invoice.buyerTaxId && formatTaxId(invoice.buyerTaxId)}
          </Row>
          <Row th="ที่อยู่" en="Address">
            <span className="whitespace-pre-line">{invoice.buyerAddress}</span>
          </Row>
        </div>
        <div className="grid grid-cols-2 grid-rows-[auto_auto_1fr]">
          <Cell th="วันที่" en="Date" className="border-r border-b">
            {longDate.format(invoice.issueDate)}
          </Cell>
          <Cell th="พนักงานขาย" en="Sales" className="border-b">
            {invoice.salesperson}
          </Cell>
          <Cell th="กำหนดวันชำระ" en="Due Date" className="border-r border-b">
            {invoice.dueDate && longDate.format(invoice.dueDate)}
          </Cell>
          <Cell th="เลขที่" en="No." className="border-b">
            {invoice.number}
          </Cell>
          <Cell th="ชื่อโปรเจ็ค" en="Project Name" className="col-span-2">
            {invoice.projectName}
          </Cell>
        </div>
      </section>

      {/* Items */}
      <table className="mt-2 w-full border-collapse border border-[var(--red)] text-[12px]">
        <thead className="bg-[var(--red)] text-white">
          <tr>
            <Th className="w-[13mm]" th="เลขที่" en="No." />
            <Th th="รายการ" en="Description" />
            <Th className="w-[19mm]" th="จำนวน" en="Quantity" />
            <Th className="w-[19mm]" th="หน่วย" en="Unit" />
            <Th className="w-[25mm]" th="ราคา/หน่วย" en="Unit Price" />
            <Th className="w-[31mm]" th="จำนวนเงิน (THB)" en="Amount" />
          </tr>
        </thead>
        <tbody className="[&_td]:border-x [&_td]:border-[var(--red)] [&_td]:px-2 [&_td]:py-[3px]">
          {invoice.items.map((item, i) => (
            <tr key={item.id} className="align-top">
              <td className="text-center">{i + 1}</td>
              <td className="pl-4">{item.description}</td>
              <td className="text-center tabular-nums">{Number(item.quantity).toLocaleString("th-TH")}</td>
              <td className="text-center">{item.unit}</td>
              <td className="text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
              <td className="text-right tabular-nums">{formatMoney(fromHundredths(gross[i]))}</td>
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

      {/* Amount in words + totals */}
      <section className="mt-3 grid grid-cols-[1fr_auto] gap-4">
        <div className="flex flex-col justify-between">
          <div className="grid grid-cols-[22mm_1fr] items-start">
            <Label th="จำนวนเงิน" en="Amount" />
            <p className="pt-0.5 text-center">{bahtText(invoice.total)}</p>
          </div>
          {notes.length > 0 && (
            <ol className="mt-4 list-decimal space-y-0.5 pl-5 text-[10px] text-slate-700">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ol>
          )}
        </div>
        <div className="grid grid-cols-[auto_36mm] gap-x-3">
          <Total th="รวมเป็นเงิน" en="Sub Total" value={formatMoney(fromHundredths(subTotal))} first />
          <Total th="หักส่วนลดพิเศษ" en="Special Discount" value={discount > 0n ? formatMoney(fromHundredths(discount)) : ""} />
          <Total th={`จำนวนภาษีมูลค่าเพิ่ม ${invoice.vatRate} %`} en="Value Added Tax" value={formatMoney(invoice.vatAmount)} />
          <Total th="จำนวนเงินรวมทั้งสิ้น" en="Total" value={formatMoney(invoice.total)} strong />
        </div>
      </section>

      {/* Signatures */}
      <section className="mt-4 grid grid-cols-3 border border-[var(--red)]">
        {[
          ["ผู้รับวางบิล", "Receiver Signature"],
          ["ผู้ส่งของ", "Deliverer Signature"],
          ["ผู้มีอำนาจลงนาม", "Authorized Signature"],
        ].map(([th, en], i) => (
          <div key={en} className={`flex h-[34mm] flex-col justify-end px-4 pb-2 text-[11.5px] ${i < 2 ? "border-r border-[var(--red)]" : ""}`}>
            <div className="mb-1 border-b border-slate-700" />
            <p className="whitespace-nowrap font-semibold">
              {th} / {en}
            </p>
            <p className="mt-1">
              วันที่ / Date <span className="inline-block w-[30mm] border-b border-slate-700" />
            </p>
          </div>
        ))}
      </section>

      {/* Footer band */}
      <footer className="mt-1.5 bg-[var(--red)] px-4 py-1 text-center text-[11px] leading-tight text-white">
        {s.nameEn && <p className="font-semibold uppercase tracking-wide">{s.nameEn}</p>}
        <p>
          {s.addressTh} เลขประจำตัวผู้เสียภาษีอากร {s.taxId}
        </p>
      </footer>
    </article>
  );
}

function Label({ th, en }: { th: string; en: string }) {
  return (
    <span className="leading-tight">
      <span className="block text-[12.5px] font-semibold">{th}</span>
      <span className="block text-[9.5px] text-slate-600">{en}</span>
    </span>
  );
}

function Row({ th, en, children }: { th: string; en: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[30mm_1fr] items-start gap-2">
      <Label th={th} en={en} />
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function Cell({ th, en, className, children }: { th: string; en: string; className: string; children: ReactNode }) {
  return (
    <div className={`grid grid-cols-[23mm_1fr] items-start gap-1 border-[var(--red)] p-2 ${className}`}>
      <Label th={th} en={en} />
      <div className="pt-0.5 text-center">{children}</div>
    </div>
  );
}

function Th({ th, en, className = "" }: { th: string; en: string; className?: string }) {
  return (
    <th className={`border-x border-white/40 px-2 py-1 text-center font-semibold leading-tight ${className}`}>
      <span className="block">{th}</span>
      <span className="block text-[10px] font-normal opacity-90">{en}</span>
    </th>
  );
}

function Total({ th, en, value, first, strong }: { th: string; en: string; value: string; first?: boolean; strong?: boolean }) {
  return (
    <>
      <Label th={th} en={en} />
      <div
        className={`flex items-center justify-end border-x-2 border-b-2 border-[var(--red)] px-2 tabular-nums ${first ? "border-t-2" : ""} ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </div>
    </>
  );
}
