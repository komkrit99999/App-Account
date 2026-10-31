"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forbidden, notFound } from "next/navigation";
import { loansEnabled } from "@/lib/features";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { loanFormValues, parseLoanForm, type LoanFieldErrors, type LoanFormValues } from "./schema";

export type LoanFormState = { errors?: LoanFieldErrors; values?: LoanFormValues };

async function validate(formData: FormData) {
  const parsed = parseLoanForm(formData);
  if (!parsed.ok) return parsed;
  const customer = await db.customer.findFirst({ where: { id: parsed.data.customerId, deletedAt: null }, select: { id: true } });
  if (!customer) return { ok: false as const, errors: { customerId: "ไม่พบผู้กู้รายนี้ หรือถูกลบไปแล้ว" } };
  return parsed;
}

/** Server actions stay callable by URL, so they check the switch themselves */
function requireLoansEnabled() {
  if (!loansEnabled()) notFound();
}

export async function createLoan(_prev: LoanFormState, formData: FormData): Promise<LoanFormState> {
  requireLoansEnabled();
  const user = await requireFeature("createLoan");
  const result = await validate(formData);
  if (!result.ok) return { errors: result.errors, values: loanFormValues(formData) };

  await db.loan.create({ data: { ...result.data, createdById: user.id } });
  revalidatePath("/loans");
  redirect(`/customers/${result.data.customerId}`);
}

/** Admins only, and they must also be able to see the amounts they are changing */
async function requireLoanEditor() {
  requireLoansEnabled();
  const user = await requireFeature("editLoan");
  if (!can(user, "viewFinancial")) forbidden();
  return user;
}

export async function updateLoan(id: string, _prev: LoanFormState, formData: FormData): Promise<LoanFormState> {
  await requireLoanEditor();
  const existing = await db.loan.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { errors: { form: "ไม่พบสัญญาเงินกู้นี้" } };

  const result = await validate(formData);
  if (!result.ok) return { errors: result.errors, values: loanFormValues(formData) };

  await db.loan.update({ where: { id }, data: result.data });
  revalidatePath("/loans");
  redirect(`/customers/${result.data.customerId}`);
}

/** ปิดยอด (repaid) or reopen */
export async function setLoanStatus(id: string, status: "ACTIVE" | "CLOSED"): Promise<void> {
  await requireLoanEditor();
  await db.loan.updateMany({
    where: { id, status: status === "CLOSED" ? "ACTIVE" : "CLOSED" },
    data: { status, closedAt: status === "CLOSED" ? new Date() : null },
  });
  revalidatePath("/loans");
  revalidatePath("/customers/[id]", "page");
}
