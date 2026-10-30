"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { TAG_COLORS } from "@/lib/tag-colors";

export type TagFormState = { error?: string; ok?: boolean };

const tagSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อแท็ก").max(50, "ชื่อแท็กยาวเกิน 50 ตัวอักษร"),
  color: z.enum(Object.keys(TAG_COLORS) as [keyof typeof TAG_COLORS]),
});

function parse(formData: FormData) {
  return tagSchema.safeParse({ name: formData.get("name"), color: formData.get("color") ?? "slate" });
}

async function nameTaken(name: string, excludeId?: string) {
  return !!(await db.tag.findFirst({ where: { name, NOT: { id: excludeId } }, select: { id: true } }));
}

export async function createTag(_prev: TagFormState, formData: FormData): Promise<TagFormState> {
  await requireFeature("manageTags");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await nameTaken(parsed.data.name)) return { error: "มีแท็กชื่อนี้อยู่แล้ว" };

  await db.tag.create({ data: parsed.data });
  revalidatePath("/tags");
  return { ok: true };
}

export async function updateTag(id: string, _prev: TagFormState, formData: FormData): Promise<TagFormState> {
  await requireFeature("manageTags");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await nameTaken(parsed.data.name, id)) return { error: "มีแท็กชื่อนี้อยู่แล้ว" };

  await db.tag.update({ where: { id }, data: parsed.data });
  revalidatePath("/tags");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<void> {
  await requireFeature("manageTags");
  await db.tag.deleteMany({ where: { id } }); // CustomerTag rows cascade
  revalidatePath("/tags");
  revalidatePath("/customers");
}
