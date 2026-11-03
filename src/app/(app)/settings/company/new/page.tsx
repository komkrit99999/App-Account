import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { saveCompany } from "@/server/company/actions";
import { CompanyForm } from "@/components/company/company-form";
import { companyFormValues } from "@/components/company/company-values";

export default async function NewCompanyPage() {
  await requireFeature("manageCompany");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/settings/company" className="text-sm text-blue-600 hover:underline">
        ← บริษัททั้งหมด
      </Link>
      <h1 className="text-2xl font-semibold">เพิ่มบริษัท</h1>
      <CompanyForm action={saveCompany.bind(null, null)} initial={companyFormValues(null)} logoUrl={null} submitLabel="เพิ่มบริษัท" />
    </div>
  );
}
