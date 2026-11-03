import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { saveCompany } from "@/server/company/actions";
import { countInvoices, getCompany, logoUrl } from "@/server/company/queries";
import { CompanyForm } from "@/components/company/company-form";
import { companyFormValues } from "@/components/company/company-values";
import { DeleteCompanyButton } from "@/components/company/delete-company-button";

export default async function CompanyPage({ params, searchParams }: PageProps<"/settings/company/[id]">) {
  await requireFeature("manageCompany");
  const id = Number((await params).id);
  const created = (await searchParams).created === "1";
  const [company, invoices] = await Promise.all([getCompany(id), countInvoices(id)]);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/settings/company" className="text-sm text-blue-600 hover:underline">
        ← บริษัททั้งหมด
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{company.nameTh || "บริษัท"}</h1>
          <p className="text-sm text-slate-500">
            ออกใบกำกับไปแล้ว {invoices.toLocaleString("th-TH")} ใบ · ใบที่ออกไปแล้วไม่เปลี่ยนตามข้อมูลที่แก้ (ยกเว้นแบบฟอร์มและโลโก้)
          </p>
        </div>
        {invoices === 0 && <DeleteCompanyButton id={company.id} name={company.nameTh} />}
      </div>
      {created && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">เพิ่มบริษัทแล้ว</p>}
      <CompanyForm action={saveCompany.bind(null, company.id)} initial={companyFormValues(company)} logoUrl={logoUrl(company)} submitLabel="บันทึก" />
    </div>
  );
}
