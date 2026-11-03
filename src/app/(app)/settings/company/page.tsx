import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { formatTaxId } from "@/lib/thai-tax-id";
import { isCompanyReady, listCompanies, logoUrl } from "@/server/company/queries";
import { buttonPrimary, cardClass } from "@/components/ui";

export default async function CompaniesPage() {
  await requireFeature("manageCompany");
  const companies = await listCompanies();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ตั้งค่าบริษัท</h1>
          <p className="text-sm text-slate-500">บริษัทผู้ออกใบกำกับภาษี · แต่ละบริษัทมีข้อมูล โลโก้ และแบบฟอร์มของตัวเอง</p>
        </div>
        <Link href="/settings/company/new" className={buttonPrimary}>
          + เพิ่มบริษัท
        </Link>
      </div>

      <ul className="space-y-3">
        {companies.map((c) => {
          const logo = logoUrl(c);
          return (
            <li key={c.id}>
              <Link href={`/settings/company/${c.id}`} className={`${cardClass} flex items-center gap-4 p-4 hover:border-blue-300 hover:bg-blue-50/40`}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- auth-protected API image
                  <img src={logo} alt="" className="h-14 w-14 shrink-0 rounded-full object-contain" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">ไม่มีโลโก้</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.nameTh || "(ยังไม่ตั้งชื่อ)"}</p>
                  <p className="text-sm text-slate-500">
                    {c.taxId ? `เลขผู้เสียภาษี ${formatTaxId(c.taxId)}` : "ยังไม่มีเลขผู้เสียภาษี"} · แบบฟอร์ม{c.invoiceTemplate === "classic" ? "น้ำตาล" : "แดง"} · VAT {c.vatRate}%
                  </p>
                </div>
                {!isCompanyReady(c) && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">ข้อมูลยังไม่ครบ</span>}
                <span className="text-slate-400">›</span>
              </Link>
            </li>
          );
        })}
        {companies.length === 0 && <li className={`${cardClass} px-4 py-10 text-center text-sm text-slate-500`}>ยังไม่มีบริษัท เพิ่มบริษัทแรกเพื่อเริ่มออกใบกำกับภาษี</li>}
      </ul>
    </div>
  );
}
