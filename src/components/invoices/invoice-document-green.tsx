import type { CSSProperties, ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { bahtText, fromHundredths, lineAmount, toHundredths } from "@/lib/invoice";
import { formatTaxId } from "@/lib/thai-tax-id";
import type { InvoiceDTO } from "@/server/invoices/queries";

// Printable A4 tax invoice — green layout: two-tone title box, a details grid
// (No./Date, PO/Ref, terms/due date, sales/ordered by), light-green table head,
// totals with discount and goods value, amount in words on a green band, and a
// "received in good order" signature panel next to the company signature box.
//
// No per-line discount column: lines show quantity × price and line discounts
// are summed into "หักส่วนลด". มูลค่าสินค้า = stored subtotal.

const GREEN = "#3d9a4b";
const LIGHT = "#d3ebcf";
const thaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const MIN_ROWS = 13;

export function InvoiceDocumentGreen({ invoice, copy, logoUrl }: { invoice: InvoiceDTO; copy: boolean; logoUrl: string | null }) {
  const s = invoice.seller;
  const fillerRows = Math.max(0, MIN_ROWS - invoice.items.length);
  const gross = invoice.items.map((i) => lineAmount({ quantity: i.quantity, unitPrice: i.unitPrice, discount: "" }) ?? 0n);
  const discount = invoice.items.reduce((sum, i) => sum + (toHundredths(i.discount) ?? 0n), 0n);
  const total = gross.reduce((sum, a) => sum + a, 0n);
  const notes = (s.footerNotes ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const office = s.isHeadOffice ? ["สำนักงานใหญ่", "HEAD OFFICE"] : [`สาขา ${s.branchCode}`, `BRANCH ${s.branchCode}`];
  const line1 = [s.phone && `Tel : ${s.phone}`, s.facebook && `Facebook : ${s.facebook}`].filter(Boolean).join("   ");
  const line2 = [s.email && `Email : ${s.email}`, s.lineId && `Line : ${s.lineId}`, s.lineOfficial && `Line Official : ${s.lineOfficial}`].filter(Boolean).join("   ");

  return (
    <article
      style={{ "--green": GREEN, "--light": LIGHT } as CSSProperties}
      className="relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[8mm] text-[12px] leading-snug text-slate-900 shadow-sm ring-1 ring-slate-200 [print-color-adjust:exact] print:max-w-none print:p-0 print:shadow-none print:ring-0"
    >
      {invoice.status === "CANCELLED" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="-rotate-30 rounded-xl border-8 border-red-500/40 px-10 py-4 text-8xl font-bold text-red-500/40">ยกเลิก</span>
        </div>
      )}

      {/* Seller + title */}
      <header className="flex items-start gap-3">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- auth-protected API image
          <img src={logoUrl} alt="" className="h-[22mm] w-[22mm] shrink-0 object-contain" />
        )}
        <div className="min-w-0 flex-1 text-[11px] text-slate-700">
          <p className="text-[18px] font-bold leading-tight text-[var(--green)]">
            {s.nameTh} <span className="text-[11px] font-normal">({office[0]})</span>
          </p>
          {s.nameEn && (
            <p className="text-[15px] font-bold leading-tight text-[var(--green)]">
              {s.nameEn} <span className="text-[10px] font-normal">({office[1]})</span>
            </p>
          )}
          <p className="mt-0.5">{s.addressTh}</p>
          {s.addressEn && <p>{s.addressEn}</p>}
          {line1 && <p>{line1}</p>}
          {line2 && <p>{line2}</p>}
          <p>เลขประจำตัวผู้เสียภาษี {s.taxId}</p>
        </div>
        <div className="w-[62mm] shrink-0 text-center">
          {s.headerNote && <p className="mb-1 text-[12px] text-slate-600">{s.headerNote}</p>}
          <div className="overflow-hidden rounded-lg border-2 border-[var(--green)]">
            <p className="py-2 text-[17px] font-bold">{copy ? "สำเนาใบกำกับภาษี" : "ต้นฉบับใบกำกับภาษี"}</p>
            <p className="bg-[var(--light)] py-2 text-[15px] font-bold tracking-wide">{copy ? "COPY TAX INVOICE" : "ORIGINAL TAX INVOICE"}</p>
          </div>
        </div>
      </header>

      {/* Buyer + document details */}
      <section className="mt-2 grid grid-cols-[1fr_1fr] overflow-hidden rounded-lg border border-[var(--green)]">
        <div className="flex flex-col gap-2 border-r border-[var(--green)] p-2.5">
          <Row th="ชื่อ" en="Name">
            {invoice.buyerName}
            {invoice.buyerBranch && ` (${invoice.buyerBranch})`}
          </Row>
          <Row th="ที่อยู่" en="Address">
            <span className="whitespace-pre-line">{invoice.buyerAddress}</span>
          </Row>
          {invoice.buyerTaxId && <p className="mt-auto pl-[18mm]">เลขประจำตัวผู้เสียภาษี {formatTaxId(invoice.buyerTaxId)}</p>}
        </div>
        <div className="grid grid-cols-2">
          <Cell th="เลขที่" en="No." className="border-r border-b">{invoice.number}</Cell>
          <Cell th="วันที่" en="Date." className="border-b">{thaiDate.format(invoice.issueDate)}</Cell>
          <Cell th="เลขที่ใบสั่งซื้อ" en="Purchase Order No." className="border-r border-b">{invoice.purchaseOrderNo}</Cell>
          <Cell th="อ้างถึง" en="Ref." className="border-b">{invoice.reference}</Cell>
          <Cell th="กำหนดชำระเงิน" en="Terms of Payment" className="border-r border-b">{invoice.paymentTerm}</Cell>
          <Cell th="วันครบกำหนด" en="Due Date" className="border-b">{invoice.dueDate && thaiDate.format(invoice.dueDate)}</Cell>
          <Cell th="พนักงานขาย" en="Sale" className="border-r">{invoice.salesperson}</Cell>
          <Cell th="ผู้สั่งสินค้า" en="Ordered By" className="">{invoice.orderedBy}</Cell>
        </div>
      </section>

      {/* Items + totals */}
      <section className="mt-2 overflow-hidden rounded-lg border border-[var(--green)]">
        <table className="w-full border-collapse text-[12px]">
          <thead className="bg-[var(--light)]">
            <tr>
              <Th className="w-[17mm]" th="ลำดับที่" en="Item" />
              <Th th="รายการสินค้า" en="Description" />
              <Th className="w-[19mm]" th="จำนวน" en="Quantity" />
              <Th className="w-[14mm]" th="หน่วย" en="Unit" />
              <Th className="w-[24mm]" th="ราคาต่อหน่วย" en="Unit Price" />
              <Th className="w-[30mm]" th="ราคารวม" en="Amount" last />
            </tr>
          </thead>
          <tbody className="[&_td]:border-r [&_td]:border-[var(--green)] [&_td:last-child]:border-r-0 [&_td]:px-2 [&_td]:py-[3px]">
            {invoice.items.map((item, i) => (
              <tr key={item.id} className="align-top">
                <td className="text-center">{i + 1}</td>
                <td className="pl-3">{item.description}</td>
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

        <div className="grid grid-cols-[1fr_auto] border-t border-[var(--green)]">
          <div className="flex flex-col">
            <div className="flex-1 px-2.5 py-1.5 text-[10.5px] text-slate-700">
              <p className="font-semibold text-slate-900">หมายเหตุ :</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
              {invoice.remark && <p className="mt-0.5">{invoice.remark}</p>}
            </div>
            <p className="border-t border-[var(--green)] bg-[var(--light)] px-3 py-2 text-center text-[14px] font-semibold">{bahtText(invoice.total)}</p>
          </div>
          <div className="grid w-[76mm] grid-cols-[1fr_30mm] border-l border-[var(--green)]">
            <Total th="รวมเป็นเงิน" en="Total" value={formatMoney(fromHundredths(total))} />
            <Total th="หักส่วนลด" en="Discount" value={discount > 0n ? formatMoney(fromHundredths(discount)) : ""} />
            <Total th="มูลค่าสินค้า" en="Amount" value={formatMoney(invoice.subtotal)} />
            <Total th="ภาษีมูลค่าเพิ่ม" en="Value Added Tax" value={formatMoney(invoice.vatAmount)} />
            <Total th="จำนวนเงินรวมทั้งสิ้น" en="Net Amount" value={formatMoney(invoice.total)} last />
          </div>
        </div>
      </section>

      {/* Signatures */}
      <section className="mt-2 grid grid-cols-[1fr_62mm] gap-2 text-[11px]">
        <div className="flex flex-col rounded-lg border border-[var(--green)]">
          <p className="border-b border-[var(--green)] px-2.5 py-1 leading-tight">
            ได้รับสินค้า/บริการข้างต้น ในสภาพดีและถูกต้องแล้ว
            <br />
            Received as per above in good order and condition
          </p>
          <div className="grid flex-1 grid-cols-3">
            {[
              ["ผู้รับสินค้า", "Received by"],
              ["ผู้รับเงิน", "Collector"],
              ["ผู้ส่งสินค้า", "Delivered by"],
            ].map(([th, en], i) => (
              <div key={en} className={`flex h-[30mm] flex-col justify-end px-2 pb-1.5 ${i < 2 ? "border-r border-[var(--green)]" : ""}`}>
                <div className="mx-2 border-b border-slate-600" />
                <p className="mt-0.5 text-center">
                  {th}/{en}
                </p>
                <p className="mt-1 whitespace-nowrap">
                  วันที่/Date <span className="inline-block w-[22mm] border-b border-slate-600" />
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-[var(--green)] p-2.5 text-center">
          <div className="leading-tight">
            <p className="font-semibold">ในนาม {s.nameTh}</p>
            {s.nameEn && <p className="font-semibold">For. {s.nameEn}</p>}
          </div>
          <div>
            <div className="mx-2 border-b border-slate-600" />
            <p className="mt-1">ลายเซ็นผู้มีอำนาจ/Authorized Signature</p>
          </div>
        </div>
      </section>
    </article>
  );
}

function Label({ th, en }: { th: string; en: string }) {
  return (
    <span className="leading-tight">
      <span className="block text-[11.5px]">{th}</span>
      <span className="block text-[10px]">{en}</span>
    </span>
  );
}

function Row({ th, en, children }: { th: string; en: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[16mm_1fr] items-start gap-2">
      <Label th={th} en={en} />
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function Cell({ th, en, className, children }: { th: string; en: string; className: string; children: ReactNode }) {
  return (
    <div className={`flex items-start justify-between gap-2 border-[var(--green)] px-2 py-1.5 ${className}`}>
      <Label th={th} en={en} />
      <div className="pt-0.5 text-right">{children}</div>
    </div>
  );
}

function Th({ th, en, className = "", last }: { th: string; en: string; className?: string; last?: boolean }) {
  return (
    <th className={`border-b border-[var(--green)] px-2 py-1 text-center font-normal leading-tight ${last ? "" : "border-r"} ${className}`}>
      <span className="block">{th}</span>
      <span className="block font-semibold">{en}</span>
    </th>
  );
}

function Total({ th, en, value, last }: { th: string; en: string; value: string; last?: boolean }) {
  const border = last ? "" : "border-b border-[var(--green)]";
  return (
    <>
      <div className={`px-2 py-1 leading-tight ${border} ${last ? "bg-[var(--light)] font-semibold" : ""}`}>
        <span className="block">{th}</span>
        <span className="block text-[10px]">{en}</span>
      </div>
      <div className={`flex items-center justify-end border-l border-[var(--green)] px-2 tabular-nums ${border} ${last ? "bg-[var(--light)] font-semibold" : ""}`}>{value}</div>
    </>
  );
}
