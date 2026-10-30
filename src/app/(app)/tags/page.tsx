import { requireFeature } from "@/lib/authz";
import { listTagsWithUsage } from "@/server/tags/queries";
import { CreateTagForm, TagRow } from "@/components/tags/tag-forms";
import { cardClass } from "@/components/ui";

export default async function TagsPage() {
  await requireFeature("manageTags");
  const tags = await listTagsWithUsage();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">จัดการแท็ก</h1>
      <div className={`${cardClass} p-4`}>
        <CreateTagForm />
      </div>
      <ul className={`${cardClass} divide-y divide-slate-100`}>
        {tags.map((t) => (
          <TagRow key={t.id} tag={{ id: t.id, name: t.name, color: t.color, count: t._count.customers }} />
        ))}
        {tags.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">ยังไม่มีแท็ก</li>}
      </ul>
    </div>
  );
}
