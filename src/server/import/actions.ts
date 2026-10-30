"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/dal";
import { IMPORT_FIELDS, importFieldsFor, type ColumnMapping, type ImportField } from "@/lib/import-fields";
import { formatCode, nextCodeNumber } from "@/server/customers/code";
import { auditEntry, auditScalarSelect, auditSelect, EMPTY_SNAPSHOT, snapshotOf, type AuditEntryInput } from "@/server/audit/log";
import { saveImportFile } from "./storage";
import { classifyRows, updateDataFor, type ClassifiedRow } from "./classify";
import { MAX_FILE_BYTES, parseSpreadsheet } from "./parse";

export type UploadState = { error?: string };

export async function uploadImportFile(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireFeature("importExcel");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์" };
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return { error: "รองรับเฉพาะไฟล์ .xlsx, .xls และ .csv" };
  if (file.size > MAX_FILE_BYTES) return { error: "ไฟล์ใหญ่เกิน 5 MB" };

  const buf = Buffer.from(await file.arrayBuffer());
  const sheet = parseSpreadsheet(buf, file.name);
  if ("error" in sheet) return { error: sheet.error };

  const batch = await db.importLog.create({
    data: {
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      headers: JSON.stringify(sheet.headers),
      rows: JSON.stringify(sheet.rows),
      totalRows: sheet.rows.length,
    },
    select: { id: true },
  });
  // Keep the original so it can be downloaded from the history page
  await saveImportFile(batch.id, buf);
  await db.importLog.update({ where: { id: batch.id }, data: { fileStored: true } });
  redirect(`/import/${batch.id}`);
}

// ---------- shared helpers ----------

/** Only the uploader can continue their own pending batch */
async function loadPendingBatch(user: CurrentUser, batchId: string) {
  const batch = await db.importLog.findFirst({ where: { id: batchId, userId: user.id, status: "PREVIEW" } });
  if (!batch) return null;
  return { ...batch, headers: JSON.parse(batch.headers) as string[], rows: JSON.parse(batch.rows) as string[][] };
}

const mappingInput = z.record(z.string(), z.string());

/** Drops unknown fields, financial fields the user can't import, and out-of-range columns */
function sanitizeMapping(raw: unknown, columnCount: number, allowed: ImportField[]): ColumnMapping | { error: string } {
  const parsed = mappingInput.safeParse(raw);
  if (!parsed.success) return { error: "ข้อมูลการจับคู่คอลัมน์ไม่ถูกต้อง" };

  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const [col, field] of Object.entries(parsed.data)) {
    const i = Number(col);
    if (!Number.isInteger(i) || i < 0 || i >= columnCount) continue;
    if (!allowed.includes(field as ImportField)) continue;
    if (used.has(field)) {
      return { error: `ฟิลด์ "${IMPORT_FIELDS[field as ImportField].label}" ถูกจับคู่มากกว่า 1 คอลัมน์` };
    }
    used.add(field);
    mapping[i] = field as ImportField;
  }
  if (!used.has("name")) return { error: `ต้องจับคู่คอลัมน์ "${IMPORT_FIELDS.name.label}"` };
  return mapping;
}

async function classify(user: CurrentUser, batch: NonNullable<Awaited<ReturnType<typeof loadPendingBatch>>>, rawMapping: unknown) {
  const canEditFinancial = can(user, "editFinancial");
  const mapping = sanitizeMapping(rawMapping, batch.headers.length, importFieldsFor({ canEditFinancial }));
  if ("error" in mapping) return mapping;

  // Look up only customers that could match something in the file
  const probe = classifyRows(batch.rows, mapping, { canEditFinancial }, []);
  const taxIds = new Set<string>();
  const phones = new Set<string>();
  for (const r of probe) {
    if (r.status === "invalid") continue;
    if (r.data.taxId) taxIds.add(r.data.taxId);
    if (r.data.phoneNormalized) phones.add(r.data.phoneNormalized);
  }
  const existing = await db.customer.findMany({
    where: { deletedAt: null, OR: [{ taxId: { in: [...taxIds] } }, { phoneNormalized: { in: [...phones] } }] },
    select: { id: true, code: true, name: true, taxId: true, branchCode: true, phoneNormalized: true },
    orderBy: { code: "asc" },
  });

  return { mapping, rows: classifyRows(batch.rows, mapping, { canEditFinancial }, existing) };
}

// ---------- analyze ----------

export type ReviewRow = {
  index: number;
  rowNumber: number;
  status: ClassifiedRow["status"];
  name: string;
  taxId: string | null;
  phone: string | null;
  errors?: string[];
  match?: { code: string; name: string; by: "taxId" | "phone" };
};

export type AnalyzeResult = { error: string } | { rows: ReviewRow[] };

export async function analyzeImport(batchId: string, rawMapping: unknown): Promise<AnalyzeResult> {
  const user = await requireFeature("importExcel");
  const batch = await loadPendingBatch(user, batchId);
  if (!batch) return { error: "ไม่พบไฟล์นำเข้านี้ หรือนำเข้าไปแล้ว" };

  const result = await classify(user, batch, rawMapping);
  if ("error" in result) return result;

  return {
    rows: result.rows.map((r) => ({
      index: r.index,
      rowNumber: r.rowNumber,
      status: r.status,
      name: r.name,
      taxId: r.taxId,
      phone: r.phone,
      ...(r.status === "invalid" && { errors: r.errors }),
      ...(r.status === "duplicate" && { match: { code: r.match.code, name: r.match.name, by: r.match.by } }),
    })),
  };
}

// ---------- commit ----------

const decisionsInput = z.object({
  duplicateDefault: z.enum(["skip", "update"]),
  overrides: z.record(z.string(), z.enum(["skip", "update"])),
});
export type ImportDecisions = z.infer<typeof decisionsInput>;

export async function commitImport(batchId: string, rawMapping: unknown, rawDecisions: unknown): Promise<{ error: string }> {
  const user = await requireFeature("importExcel");
  const decisions = decisionsInput.safeParse(rawDecisions);
  if (!decisions.success) return { error: "ข้อมูลการเลือกไม่ถูกต้อง" };

  const batch = await loadPendingBatch(user, batchId);
  if (!batch) return { error: "ไม่พบไฟล์นำเข้านี้ หรือนำเข้าไปแล้ว" };

  // Re-classify on the server — never trust results sent back from the browser
  const result = await classify(user, batch, rawMapping);
  if ("error" in result) return result;

  const { duplicateDefault, overrides } = decisions.data;
  const toCreate = result.rows.filter((r) => r.status === "new");
  const duplicates = result.rows.filter((r) => r.status === "duplicate");
  const toUpdate = duplicates.filter((r) => (overrides[r.index] ?? duplicateDefault) === "update");
  const failed = result.rows.filter((r) => r.status === "invalid");
  const now = new Date();

  const outcome = await db.$transaction(async (tx) => {
    // Claim the batch first so a double-submit can't import twice
    const claimed = await tx.importLog.updateMany({
      where: { id: batch.id, status: "PREVIEW" },
      data: { status: "COMPLETED" },
    });
    if (claimed.count === 0) return null;

    const audit: NonNullable<ReturnType<typeof auditEntry>>[] = [];
    const record = (input: Omit<AuditEntryInput, "userId" | "importLogId">) => {
      const entry = auditEntry({ ...input, userId: user.id, importLogId: batch.id });
      if (entry) audit.push(entry);
    };

    let n = await nextCodeNumber(tx);
    const created = await tx.customer.createManyAndReturn({
      // tagIds is always [] for imports and isn't a Customer column
      data: toCreate.map(({ data: { tagIds, ...data } }) => {
        void tagIds;
        return { ...data, code: formatCode(n++), createdById: user.id };
      }),
      select: auditScalarSelect,
    });
    for (const c of created) record({ action: "CREATE", customer: c, before: EMPTY_SNAPSHOT, after: snapshotOf(c) });

    let updated = 0;
    const lostMatches: ClassifiedRow[] = [];
    for (const r of toUpdate) {
      const before = await tx.customer.findFirst({ where: { id: r.match.id, deletedAt: null }, select: auditSelect });
      if (!before) {
        lostMatches.push(r);
        continue;
      }
      const after = await tx.customer.update({
        where: { id: before.id },
        data: { ...updateDataFor(r.data, r.provided), updatedById: user.id },
        select: auditSelect,
      });
      record({ action: "UPDATE", customer: after, before: snapshotOf(before), after: snapshotOf(after) });
      updated++;
    }
    await tx.auditLog.createMany({ data: audit });

    const errors = [
      ...failed.map((r) => ({ batchId: batch.id, rowNumber: r.rowNumber, message: r.errors.join(" · ") })),
      ...lostMatches.map((r) => ({ batchId: batch.id, rowNumber: r.rowNumber, message: "ลูกค้าที่จะอัปเดตถูกลบไปก่อนยืนยัน" })),
    ];
    await tx.importRowError.createMany({ data: errors });

    await tx.importLog.update({
      where: { id: batch.id },
      data: {
        columnMapping: JSON.stringify(result.mapping),
        rows: "[]", // staged data no longer needed
        createdRows: toCreate.length,
        updatedRows: updated,
        skippedRows: duplicates.length - toUpdate.length,
        failedRows: errors.length,
        completedAt: now,
      },
    });
    return true;
  });

  if (!outcome) return { error: "ไฟล์นี้ถูกนำเข้าไปแล้ว" };
  revalidatePath("/customers");
  redirect(`/import/${batch.id}`);
}

export async function cancelImport(batchId: string): Promise<void> {
  const user = await requireFeature("importExcel");
  await db.importLog.updateMany({
    where: { id: batchId, userId: user.id, status: "PREVIEW" },
    data: { status: "CANCELLED", rows: "[]", completedAt: new Date() },
  });
  redirect("/import");
}
