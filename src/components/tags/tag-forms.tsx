"use client";

import { useActionState, useState, useTransition } from "react";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";
import { TagBadge } from "@/components/tag-badge";
import { TAG_COLOR_LABELS, type TagColor } from "@/lib/tag-colors";
import { createTag, deleteTag, updateTag, type TagFormState } from "@/server/tags/actions";

function ColorSelect({ defaultValue = "slate" }: { defaultValue?: string }) {
  return (
    <select name="color" defaultValue={defaultValue} className={`${inputClass} w-28`} aria-label="สี">
      {(Object.keys(TAG_COLOR_LABELS) as TagColor[]).map((c) => (
        <option key={c} value={c}>
          {TAG_COLOR_LABELS[c]}
        </option>
      ))}
    </select>
  );
}

export function CreateTagForm() {
  const [state, action, pending] = useActionState<TagFormState, FormData>(createTag, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input name="name" placeholder="ชื่อแท็กใหม่" required className={`${inputClass} max-w-xs`} aria-label="ชื่อแท็ก" />
        <ColorSelect />
        <button disabled={pending} className={buttonPrimary}>
          + เพิ่มแท็ก
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

type Tag = { id: string; name: string; color: string; count: number };

export function TagRow({ tag }: { tag: Tag }) {
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [state, action, pending] = useActionState<TagFormState, FormData>(
    async (prev, formData) => {
      const result = await updateTag(tag.id, prev, formData);
      if (result.ok) setEditing(false);
      return result;
    },
    {},
  );

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input name="name" defaultValue={tag.name} required className={`${inputClass} max-w-xs`} aria-label="ชื่อแท็ก" />
          <ColorSelect defaultValue={tag.color} />
          <button disabled={pending} className={buttonPrimary}>บันทึก</button>
          <button type="button" onClick={() => setEditing(false)} className={buttonSecondary}>ยกเลิก</button>
        </form>
        {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <TagBadge name={tag.name} color={tag.color} />
        <span className="text-sm text-slate-500">{tag.count.toLocaleString("th-TH")} ราย</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditing(true)} className={buttonSecondary}>แก้ไข</button>
        <button
          disabled={deleting}
          className={buttonDanger}
          onClick={() => {
            const msg = tag.count > 0 ? `แท็กนี้ติดอยู่กับลูกค้า ${tag.count} ราย ยืนยันลบ "${tag.name}" ?` : `ยืนยันลบแท็ก "${tag.name}" ?`;
            if (confirm(msg)) startDelete(() => deleteTag(tag.id));
          }}
        >
          ลบ
        </button>
      </div>
    </li>
  );
}
