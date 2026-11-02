import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { todayDateInput } from "@/lib/format";
import { formatTaxId } from "@/lib/thai-tax-id";
import { createInvoice } from "@/server/invoices/actions";
import { listBuyerOptions } from "@/server/invoices/buyers";
import { MAX_ITEMS } from "@/server/invoices/schema";
import { getCompany, isCompanyReady } from "@/server/company/queries";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { cardClass } from "@/components/ui";

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const user = await requireFeature("createInvoice");
  const sp = await searchParams;
  const [company, buyers] = await Promise.all([getCompany(), listBuyerOptions()]);

  if (!isCompanyReady(company)) {
    return (
      <div className={`${cardClass} mx-auto max-w-xl space-y-2 p-6 text-sm`}>
        <h1 className="text-lg font-semibold">ยังออกใบกำกับภาษีไม่ได้</h1>
        <p>ต้องตั้งค่าข้อมูลบริษัทผู้ขาย (ชื่อ ที่อยู่ เลขประจำตัวผู้เสียภาษี) ก่อน</p>
        {can(user, "manageCompany") ? (
          <Link href="/settings/company" className="text-blue-700 hover:underline">
            ไปที่ตั้งค่าบริษัท →
          </Link>
        ) : (
          <p className="text-slate-500">ติดต่อ admin เพื่อตั้งค่า</p>
        )}
      </div>
    );
  }

  const pre = buyers.find((b) => b.id === sp.customer);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">ออกใบกำกับภาษี</h1>
      <InvoiceForm
        action={createInvoice}
        initial={{
          fields: {
            customerId: pre?.id ?? "",
            buyerName: pre ? pre.companyName || pre.name : "",
            buyerBranch: pre?.taxId ? (pre.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${pre.branchCode}`) : "",
            buyerAddress: pre?.address ?? "",
            buyerTaxId: pre?.taxId ? formatTaxId(pre.taxId) : "",
            issueDate: todayDateInput(),
            dueDate: "",
            salesperson: user.displayName,
            paymentTerm: "เงินสด",
            remark: "",
          },
          items: [],
        }}
        buyers={buyers}
        vatRate={company.vatRate}
        maxItems={MAX_ITEMS}
        submitLabel="ออกใบกำกับภาษี"
        cancelHref={pre ? `/customers/${pre.id}` : "/invoices"}
      />
    </div>
  );
}
