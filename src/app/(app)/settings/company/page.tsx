import { requireFeature } from "@/lib/authz";
import { formatTaxId } from "@/lib/thai-tax-id";
import { saveCompany } from "@/server/company/actions";
import { getCompany } from "@/server/company/queries";
import { CompanyForm } from "@/components/company/company-form";

export default async function CompanySettingsPage() {
  await requireFeature("manageCompany");
  const c = await getCompany();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">ตั้งค่าบริษัท</h1>
        <p className="text-sm text-slate-500">ข้อมูลผู้ขายที่พิมพ์บนใบกำกับภาษี · ใบที่ออกไปแล้วไม่เปลี่ยนตาม</p>
      </div>
      <CompanyForm
        action={saveCompany}
        hasLogo={c.hasLogo}
        initial={{
          nameTh: c.nameTh,
          nameEn: c.nameEn ?? "",
          addressTh: c.addressTh ?? "",
          addressEn: c.addressEn ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          lineId: c.lineId ?? "",
          facebook: c.facebook ?? "",
          taxId: c.taxId ? formatTaxId(c.taxId) : "",
          branchType: c.isHeadOffice ? "head" : "branch",
          branchCode: c.branchCode ?? "",
          headerNote: c.headerNote ?? "",
          vatRate: c.vatRate,
        }}
      />
    </div>
  );
}
