import Link from "next/link";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { formatTaxId } from "@/lib/thai-tax-id";
import { formatMoney } from "@/lib/format";
import { tagColorClass } from "@/lib/tag-colors";
import { listCustomers } from "@/server/customers/queries";
import { listTags } from "@/server/tags/queries";
import { TagBadge } from "@/components/tag-badge";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/components/ui";

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const user = await requireFeature("viewCustomers");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tagIds = [sp.tag ?? []].flat();
  const page = Number(sp.page) || 1;

  const [{ customers, total, pageCount }, tags] = await Promise.all([
    listCustomers(user, { q, tagIds, page }),
    listTags(),
  ]);
  const showFinancial = can(user, "viewFinancial");

  const href = (next: { tagIds?: string[]; page?: number }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const id of next.tagIds ?? tagIds) params.append("tag", id);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const s = params.toString();
    return s ? `/customers?${s}` : "/customers";
  };
  // Export uses the current search + tag filters, but every page
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  for (const id of tagIds) exportParams.append("tag", id);
  const exportHref = `/api/customers/export${exportParams.size ? `?${exportParams}` : ""}`;

  const toggleTag = (id: string) =>
    href({ tagIds: tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id] });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ลูกค้า</h1>
        <div className="flex flex-wrap gap-2">
          {can(user, "exportExcel") && total > 0 && (
            <a
              href={exportHref}
              download
              className={buttonSecondary}
              title={showFinancial ? undefined : "ไฟล์จะไม่มีคอลัมน์ข้อมูลการเงิน"}
            >
              ⬇ Export Excel ({total.toLocaleString("th-TH")} ราย)
            </a>
          )}
          {can(user, "createCustomer") && (
            <Link href="/customers/new" className={buttonPrimary}>
              + เพิ่มลูกค้า
            </Link>
          )}
        </div>
      </div>

      <div className={`${cardClass} space-y-3 p-4`}>
        <form className="flex gap-2" action="/customers">
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาชื่อ บริษัท เบอร์โทร อีเมล เลขภาษี หรือรหัสลูกค้า"
            className={inputClass}
          />
          {tagIds.map((id) => (
            <input key={id} type="hidden" name="tag" value={id} />
          ))}
          <button className={buttonSecondary}>ค้นหา</button>
        </form>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">กรองตามแท็ก:</span>
            {tags.map((tag) => {
              const active = tagIds.includes(tag.id);
              return (
                <Link
                  key={tag.id}
                  href={toggleTag(tag.id)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1 ring-1 ring-inset ${tagColorClass(tag.color)} ${active ? "ring-2" : "opacity-50 hover:opacity-80"}`}
                >
                  {active && "✓ "}
                  {tag.name}
                </Link>
              );
            })}
            {(tagIds.length > 0 || q) && (
              <Link href="/customers" className="text-blue-600 hover:underline">
                ล้างตัวกรอง
              </Link>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500">พบ {total.toLocaleString("th-TH")} ราย</p>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">รหัส</th>
              <th className="px-4 py-2.5 font-medium">ชื่อลูกค้า</th>
              <th className="px-4 py-2.5 font-medium">เบอร์โทร</th>
              <th className="px-4 py-2.5 font-medium">เลขผู้เสียภาษี</th>
              <th className="px-4 py-2.5 font-medium">แท็ก</th>
              {showFinancial && <th className="px-4 py-2.5 text-right font-medium">วงเงินเครดิต</th>}
              {showFinancial && <th className="px-4 py-2.5 text-right font-medium">ยอดค้างชำระ</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{c.code}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/customers/${c.id}`} className="font-medium text-blue-700 hover:underline">
                    {c.name}
                  </Link>
                  {c.companyName && <div className="text-xs text-slate-500">{c.companyName}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">{c.phone ?? "–"}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {c.taxId ? formatTaxId(c.taxId) : "–"}
                  {c.taxId && !c.isHeadOffice && <div className="text-xs text-slate-500">สาขา {c.branchCode}</div>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <TagBadge key={t.id} name={t.name} color={t.color} />
                    ))}
                  </div>
                </td>
                {c.financial && (
                  <>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatMoney(c.financial.creditLimit)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatMoney(c.financial.outstandingBalance)}</td>
                  </>
                )}
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={showFinancial ? 7 : 5} className="px-4 py-10 text-center text-slate-500">
                  ไม่พบลูกค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href({ page: page - 1 })} className={buttonSecondary}>← ก่อนหน้า</Link>}
          <span className="text-slate-500">
            หน้า {page} / {pageCount}
          </span>
          {page < pageCount && <Link href={href({ page: page + 1 })} className={buttonSecondary}>ถัดไป →</Link>}
        </nav>
      )}
    </div>
  );
}
