import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { todayDateInput } from "@/lib/format";
import { formatTaxId } from "@/lib/thai-tax-id";
import { createInvoice } from "@/server/invoices/actions";
import { listBuyerOptions } from "@/server/invoices/buyers";
import { lastInvoiceNumber } from "@/server/invoices/queries";
import { MAX_ITEMS } from "@/server/invoices/schema";
import { isCompanyReady, listCompanies, logoUrl, type CompanyDTO } from "@/server/company/queries";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { cardClass } from "@/components/ui";

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const user = await requireFeature("createInvoice");
  const sp = await searchParams;
  const customerId = typeof sp.customer === "string" ? sp.customer : "";
  const companies = (await listCompanies()).filter(isCompanyReady);

  if (companies.length === 0) {
    return (
      <div className={`${cardClass} mx-auto max-w-xl space-y-2 p-6 text-sm`}>
        <h1 className="text-lg font-semibold">ยังออกใบกำกับภาษีไม่ได้</h1>
        <p>ต้องเพิ่มบริษัทผู้ขาย พร้อมชื่อ ที่อยู่ และเลขประจำตัวผู้เสียภาษีก่อน</p>
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

  // One company → straight to its form; several → pick one first
  const company = companies.length === 1 ? companies[0] : companies.find((c) => String(c.id) === sp.company);
  if (!company) return <CompanyPicker companies={companies} customerId={customerId} />;

  const [buyers, lastNumber] = await Promise.all([listBuyerOptions(), lastInvoiceNumber(company.id)]);
  const pre = buyers.find((b) => b.id === customerId);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ออกใบกำกับภาษี</h1>
          <p className="text-sm text-slate-600">
            ในนาม <span className="font-medium text-slate-900">{company.nameTh}</span>
          </p>
        </div>
        {companies.length > 1 && (
          <Link href={`/invoices/new${customerId ? `?customer=${customerId}` : ""}`} className="text-sm text-blue-700 hover:underline">
            เปลี่ยนบริษัท
          </Link>
        )}
      </div>
      <InvoiceForm
        action={createInvoice}
        initial={{
          fields: {
            companyId: String(company.id),
            number: "",
            customerId: pre?.id ?? "",
            buyerName: pre ? pre.companyName || pre.name : "",
            buyerBranch: pre?.taxId ? (pre.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${pre.branchCode}`) : "",
            buyerAddress: pre?.address ?? "",
            buyerTaxId: pre?.taxId ? formatTaxId(pre.taxId) : "",
            issueDate: todayDateInput(),
            dueDate: "",
            salesperson: user.displayName,
            projectName: "",
            purchaseOrderNo: "",
            reference: "",
            orderedBy: "",
            paymentTerm: "เงินสด",
            remark: "",
          },
          items: [],
        }}
        buyers={buyers}
        lastNumber={lastNumber}
        vatRate={company.vatRate}
        maxItems={MAX_ITEMS}
        submitLabel="ออกใบกำกับภาษี"
        cancelHref={pre ? `/customers/${pre.id}` : "/invoices"}
      />
    </div>
  );
}

const TEMPLATE_LABEL = { red: "แบบแดง", classic: "แบบน้ำตาล", green: "แบบเขียว", mono: "แบบขาวดำ" } as const;

function CompanyPicker({ companies, customerId }: { companies: CompanyDTO[]; customerId: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">ออกใบกำกับภาษี</h1>
        <p className="text-sm text-slate-500">เลือกบริษัทผู้ออกใบกำกับ แล้วจะเปิดฟอร์มของบริษัทนั้น</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {companies.map((c) => {
          const logo = logoUrl(c);
          const params = new URLSearchParams({ company: String(c.id), ...(customerId && { customer: customerId }) });
          return (
            <li key={c.id}>
              <Link href={`/invoices/new?${params}`} className={`${cardClass} flex h-full items-center gap-3 p-4 hover:border-blue-300 hover:bg-blue-50/40`}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- auth-protected API image
                  <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-full object-contain" />
                ) : (
                  <span className="h-12 w-12 shrink-0 rounded-full bg-slate-100" />
                )}
                <span className="min-w-0">
                  <span className="block font-medium">{c.nameTh}</span>
                  <span className="block text-xs text-slate-500">
                    {formatTaxId(c.taxId ?? "")} · {TEMPLATE_LABEL[c.invoiceTemplate]}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
