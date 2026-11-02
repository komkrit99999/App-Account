"use server";

import { forbidden, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { computeTotals } from "@/lib/invoice";
import { Prisma } from "@/generated/prisma/client";
import { getCompany, isCompanyReady } from "@/server/company/queries";
import type { SellerSnapshot } from "./queries";
import { invoiceFormValues, parseInvoiceForm, type InvoiceFieldErrors, type InvoiceFormValues, type InvoiceInput } from "./schema";

export type InvoiceFormState = { errors?: InvoiceFieldErrors; values?: InvoiceFormValues };

/** Error for a number already used by another invoice (cancelled ones included — numbers are never reused) */
async function numberTaken(number: string, exceptId?: string) {
  const other = await db.invoice.findUnique({ where: { number }, select: { id: true, status: true } });
  if (!other || other.id === exceptId) return null;
  return other.status === "CANCELLED" ? "เลขที่นี้เคยใช้กับใบที่ยกเลิกแล้ว ใช้ซ้ำไม่ได้" : "เลขที่นี้มีอยู่แล้ว";
}

async function validate(formData: FormData, vatRate: string, exceptId?: string) {
  const parsed = parseInvoiceForm(formData);
  if (!parsed.ok) return parsed;
  const taken = await numberTaken(parsed.data.number, exceptId);
  if (taken) return { ok: false as const, errors: { number: taken } };
  const customer = await db.customer.findFirst({ where: { id: parsed.data.customerId, deletedAt: null }, select: { id: true } });
  if (!customer) return { ok: false as const, errors: { customerId: "ไม่พบลูกค้ารายนี้ หรือถูกลบไปแล้ว" } };
  // Totals are always computed here — anything the browser sends is ignored
  const totals = computeTotals(parsed.data.items, vatRate);
  if (!totals) return { ok: false as const, errors: { items: "ตรวจตัวเลขในรายการสินค้า" } };
  return { ok: true as const, data: parsed.data, totals };
}

function itemRows(data: InvoiceInput, amounts: string[]) {
  return data.items.map((item, position) => ({
    position,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    discount: item.discount || "0",
    amount: amounts[position],
  }));
}

function headerData({ items, ...data }: InvoiceInput) {
  void items;
  return data;
}

export async function createInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireFeature("createInvoice");
  const company = await getCompany();
  if (!isCompanyReady(company)) return { errors: { form: "ยังไม่ได้ตั้งค่าข้อมูลบริษัท (ชื่อ ที่อยู่ เลขผู้เสียภาษี) — ติดต่อ admin" }, values: invoiceFormValues(formData) };

  const result = await validate(formData, company.vatRate);
  if (!result.ok) return { errors: result.errors, values: invoiceFormValues(formData) };
  const { data, totals } = result;

  const { vatRate, hasLogo, ...seller } = company;
  void hasLogo;
  const sellerSnapshot: SellerSnapshot = seller;

  // seq (internal order) is taken inside the transaction; a simultaneous submit
  // that grabs the same seq hits the unique index and retries. The same
  // number submitted twice at once also hits a unique index — that one is
  // reported instead of retried.
  let id: string | null = null;
  for (let attempt = 0; attempt < 5 && !id; attempt++) {
    try {
      id = await db.$transaction(async (tx) => {
        const last = await tx.invoice.aggregate({ _max: { seq: true } });
        const invoice = await tx.invoice.create({
          data: {
            ...headerData(data),
            seq: (last._max.seq ?? 0) + 1,
            seller: JSON.stringify(sellerSnapshot),
            subtotal: totals.subtotal,
            vatRate,
            vatAmount: totals.vatAmount,
            total: totals.total,
            createdById: user.id,
            items: { create: itemRows(data, totals.amounts) },
          },
          select: { id: true },
        });
        return invoice.id;
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      const taken = await numberTaken(data.number);
      if (taken) return { errors: { number: taken }, values: invoiceFormValues(formData) };
    }
  }
  if (!id) return { errors: { form: "บันทึกไม่สำเร็จ ลองอีกครั้ง" }, values: invoiceFormValues(formData) };

  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

/** Admins only, and they must be able to see amounts (viewFinancial) */
async function requireInvoiceEditor() {
  const user = await requireFeature("editInvoice");
  if (!can(user, "viewFinancial")) forbidden();
  return user;
}

export async function updateInvoice(id: string, _prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireInvoiceEditor();
  const existing = await db.invoice.findUnique({ where: { id }, select: { status: true, vatRate: true } });
  if (!existing) return { errors: { form: "ไม่พบใบกำกับภาษีนี้" } };
  if (existing.status === "CANCELLED") return { errors: { form: "ใบกำกับภาษีนี้ถูกยกเลิกแล้ว แก้ไขไม่ได้" } };

  // Keeps the VAT rate and seller it was issued with; the number may change but not to one in use
  const result = await validate(formData, existing.vatRate.toString(), id);
  if (!result.ok) return { errors: result.errors, values: invoiceFormValues(formData) };
  const { data, totals } = result;

  try {
    await db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          ...headerData(data),
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          updatedById: user.id,
          items: { create: itemRows(data, totals.amounts) },
        },
      });
    });
  } catch (e) {
    // Another invoice took this number between the check and the save
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    return { errors: { number: "เลขที่นี้มีอยู่แล้ว" }, values: invoiceFormValues(formData) };
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

/** Tax invoices are never deleted; cancelling keeps the number used */
export async function cancelInvoice(id: string): Promise<void> {
  const user = await requireInvoiceEditor();
  await db.invoice.updateMany({
    where: { id, status: "ISSUED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), updatedById: user.id },
  });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}
