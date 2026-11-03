import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { getInvoice } from "@/server/invoices/queries";
import { getCompany, logoUrl } from "@/server/company/queries";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { InvoiceDocumentRed } from "@/components/invoices/invoice-document-red";
import { InvoiceDocumentGreen } from "@/components/invoices/invoice-document-green";
import { InvoiceDocumentMono } from "@/components/invoices/invoice-document-mono";
import { CancelInvoiceButton, PrintButton } from "@/components/invoices/invoice-actions";
import { buttonPrimary, buttonSecondary } from "@/components/ui";

export default async function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const user = await requireFeature("createInvoice");
  const { id } = await params;
  const copy = (await searchParams).copy === "1";
  const invoice = await getInvoice(user, id);
  if (!invoice) notFound();
  // Layout and logo follow the issuing company's current settings
  const company = await getCompany(invoice.companyId);
  const logo = company ? logoUrl(company) : null;
  const template = company?.invoiceTemplate ?? "red";
  const canEdit = can(user, "editInvoice") && can(user, "viewFinancial") && invoice.status === "ISSUED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/invoices" className="text-sm text-blue-600 hover:underline">
          ← ใบกำกับภาษีทั้งหมด
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="mr-2 flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm" aria-label="ฉบับ">
            {[
              [false, "ต้นฉบับ"],
              [true, "สำเนา"],
            ].map(([isCopy, label]) => (
              <Link
                key={String(label)}
                href={isCopy ? `/invoices/${id}?copy=1` : `/invoices/${id}`}
                aria-current={copy === isCopy ? "page" : undefined}
                className={`rounded-md px-3 py-1 ${copy === isCopy ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {canEdit && (
            <>
              <Link href={`/invoices/${id}/edit`} className={buttonSecondary}>
                แก้ไข
              </Link>
              <CancelInvoiceButton id={id} number={invoice.number} />
            </>
          )}
          <PrintButton className={buttonPrimary}>พิมพ์</PrintButton>
        </div>
      </div>

      {company && !logo && can(user, "manageCompany") && (
        <p className="mx-auto max-w-[210mm] rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
          ใบกำกับยังไม่มีโลโก้ ·{" "}
          <Link href={`/settings/company/${company.id}#logo`} className="font-medium text-blue-700 hover:underline">
            เพิ่มโลโก้ที่ตั้งค่าบริษัท →
          </Link>
        </p>
      )}

      {template === "classic" && <InvoiceDocument invoice={invoice} copy={copy} logoUrl={logo} />}
      {template === "red" && <InvoiceDocumentRed invoice={invoice} copy={copy} logoUrl={logo} />}
      {template === "green" && <InvoiceDocumentGreen invoice={invoice} copy={copy} logoUrl={logo} />}
      {template === "mono" && <InvoiceDocumentMono invoice={invoice} copy={copy} logoUrl={logo} />}

      <p className="text-center text-xs text-slate-500 print:hidden">
        ออกโดย {invoice.createdBy} เมื่อ {formatDateTime(invoice.createdAt)}
        {invoice.updatedBy && ` · แก้ไขล่าสุดโดย ${invoice.updatedBy} เมื่อ ${formatDateTime(invoice.updatedAt)}`}
        {invoice.cancelledAt && ` · ยกเลิกเมื่อ ${formatDateTime(invoice.cancelledAt)}`}
      </p>
    </div>
  );
}
