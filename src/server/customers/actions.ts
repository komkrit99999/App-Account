"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { auditSelect, EMPTY_SNAPSHOT, logCustomerChange, snapshotOf } from "@/server/audit/log";
import { formatCode, nextCodeNumber } from "./code";
import { formValues, parseCustomerForm, type CustomerFormValues, type FieldErrors } from "./schema";

export type CustomerFormState = { errors?: FieldErrors; values?: CustomerFormValues };

async function validate(formData: FormData, canEditFinancial: boolean, excludeId?: string) {
  const parsed = parseCustomerForm(formData, { canEditFinancial });
  if (!parsed.ok) return parsed;

  const { data } = parsed;
  const errors: FieldErrors = {};

  if (data.taxId) {
    const duplicate = await db.customer.findFirst({
      where: { taxId: data.taxId, branchCode: data.branchCode, deletedAt: null, NOT: { id: excludeId } },
      select: { code: true, name: true },
    });
    if (duplicate) {
      errors.taxId = `เลขภาษีและสาขานี้ซ้ำกับลูกค้า ${duplicate.code} ${duplicate.name}`;
    }
  }

  const tagCount = await db.tag.count({ where: { id: { in: data.tagIds } } });
  if (tagCount !== data.tagIds.length) errors.tagIds = "มีแท็กที่ถูกลบไปแล้ว กรุณาเลือกใหม่";

  return Object.keys(errors).length ? { ok: false as const, errors } : parsed;
}

export async function createCustomer(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const user = await requireFeature("createCustomer");
  const result = await validate(formData, can(user, "editFinancial"));
  if (!result.ok) return { errors: result.errors, values: formValues(formData) };

  const { tagIds, ...data } = result.data;
  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        ...data,
        code: formatCode(await nextCodeNumber(tx)),
        createdById: user.id,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      select: auditSelect,
    });
    await logCustomerChange(tx, {
      userId: user.id,
      action: "CREATE",
      customer: created,
      before: EMPTY_SNAPSHOT,
      after: snapshotOf(created),
    });
    return created;
  });

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(
  id: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireFeature("editCustomer");
  const existing = await db.customer.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) return { errors: { form: "ไม่พบลูกค้ารายนี้ หรือถูกลบไปแล้ว" } };

  const result = await validate(formData, can(user, "editFinancial"), id);
  if (!result.ok) return { errors: result.errors, values: formValues(formData) };

  const { tagIds, ...data } = result.data;
  await db.$transaction(async (tx) => {
    const before = await tx.customer.findUniqueOrThrow({ where: { id }, select: auditSelect });
    const after = await tx.customer.update({
      where: { id },
      data: {
        ...data,
        updatedById: user.id,
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
      select: auditSelect,
    });
    await logCustomerChange(tx, {
      userId: user.id,
      action: "UPDATE",
      customer: after,
      before: snapshotOf(before),
      after: snapshotOf(after),
    });
  });

  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string): Promise<void> {
  const user = await requireFeature("deleteCustomer");
  await db.$transaction(async (tx) => {
    const before = await tx.customer.findFirst({ where: { id, deletedAt: null }, select: auditSelect });
    if (!before) return;
    // Soft delete — keeps the row for history and recovery
    await tx.customer.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await logCustomerChange(tx, {
      userId: user.id,
      action: "DELETE",
      customer: before,
      before: snapshotOf(before),
      after: EMPTY_SNAPSHOT,
    });
  });

  revalidatePath("/customers");
  redirect("/customers");
}
