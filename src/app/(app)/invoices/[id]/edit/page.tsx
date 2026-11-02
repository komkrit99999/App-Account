import { forbidden, notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { toDateInput } from "@/lib/format";
import { formatTaxId } from "@/lib/thai-tax-id";
import { updateInvoice } from "@/server/invoices/actions";
import { listBuyerOptions } from "@/server/invoices/buyers";
import { getInvoice } from "@/server/invoices/queries";
import { MAX_ITEMS } from "@/server/invoices/schema";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const user = await requireFeature("editInvoice");
  if (!can(user, "viewFinancial")) forbidden();
  const { id } = await params;
  const [invoice, buyers] = await Promise.all([getInvoice(user, id), listBuyerOptions()]);
  if (!invoice || invoice.status === "CANCELLED") notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">
        แก้ไขใบกำกับภาษี <span className="text-slate-400">{invoice.number}</span>
      </h1>
      <p className="text-sm text-slate-500">เลขที่เอกสาร อัตรา VAT และข้อมูลผู้ขายคงเดิมตามวันที่ออก</p>
      <InvoiceForm
        action={updateInvoice.bind(null, invoice.id)}
        initial={{
          fields: {
            customerId: invoice.customerId,
            buyerName: invoice.buyerName,
            buyerBranch: invoice.buyerBranch ?? "",
            buyerAddress: invoice.buyerAddress ?? "",
            buyerTaxId: invoice.buyerTaxId ? formatTaxId(invoice.buyerTaxId) : "",
            issueDate: toDateInput(invoice.issueDate),
            dueDate: toDateInput(invoice.dueDate),
            salesperson: invoice.salesperson ?? "",
            paymentTerm: invoice.paymentTerm ?? "",
            remark: invoice.remark ?? "",
          },
          items: invoice.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unit: i.unit ?? "",
            unitPrice: i.unitPrice,
            discount: Number(i.discount) ? i.discount : "",
          })),
        }}
        buyers={buyers}
        vatRate={invoice.vatRate}
        maxItems={MAX_ITEMS}
        submitLabel="บันทึกการแก้ไข"
        cancelHref={`/invoices/${invoice.id}`}
      />
    </div>
  );
}
