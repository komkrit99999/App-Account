// Pure helpers for field-level customer change logs (no DB, unit-tested).

export const AUDIT_FIELDS = {
  name: { label: "ชื่อลูกค้า" },
  phone: { label: "เบอร์โทร" },
  email: { label: "อีเมล" },
  address: { label: "ที่อยู่" },
  note: { label: "หมายเหตุ" },
  companyName: { label: "ชื่อบริษัท" },
  taxId: { label: "เลขประจำตัวผู้เสียภาษี" },
  branch: { label: "สำนักงาน/สาขา" },
  contactPerson: { label: "ผู้ติดต่อ" },
  creditLimit: { label: "วงเงินเครดิต", financial: true },
  paymentTermDays: { label: "เงื่อนไขชำระเงิน (วัน)", financial: true },
  outstandingBalance: { label: "ยอดค้างชำระ", financial: true },
  tags: { label: "แท็ก" },
} as const satisfies Record<string, { label: string; financial?: boolean }>;

export type AuditField = keyof typeof AUDIT_FIELDS;
export type Snapshot = Record<AuditField, string | null>;
export type Change = { field: AuditField; from: string | null; to: string | null };
/** What the history page receives — financial values blanked for viewers without viewFinancial */
export type VisibleChange = Change & { hidden?: true };

export const EMPTY_SNAPSHOT: Snapshot = Object.fromEntries(
  Object.keys(AUDIT_FIELDS).map((k) => [k, null]),
) as Snapshot;

type DecimalLike = { toFixed(dp: number): string };

export type SnapshotSource = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  companyName: string | null;
  taxId: string | null;
  isHeadOffice: boolean;
  branchCode: string | null;
  contactPerson: string | null;
  creditLimit: DecimalLike | null;
  paymentTermDays: number | null;
  outstandingBalance: DecimalLike | null;
  tags?: { tag: { name: string } }[];
};

export function snapshotOf(c: SnapshotSource): Snapshot {
  return {
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    note: c.note,
    companyName: c.companyName,
    taxId: c.taxId,
    branch: c.isHeadOffice ? "สำนักงานใหญ่" : `สาขา ${c.branchCode}`,
    contactPerson: c.contactPerson,
    creditLimit: c.creditLimit?.toFixed(2) ?? null,
    paymentTermDays: c.paymentTermDays?.toString() ?? null,
    outstandingBalance: c.outstandingBalance?.toFixed(2) ?? null,
    tags: c.tags?.length ? c.tags.map((t) => t.tag.name).sort((a, b) => a.localeCompare(b, "th")).join(", ") : null,
  };
}

export function diffSnapshots(before: Snapshot, after: Snapshot): Change[] {
  const changes: Change[] = [];
  for (const field of Object.keys(AUDIT_FIELDS) as AuditField[]) {
    const from = before[field] || null;
    const to = after[field] || null;
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

export function isFinancial(field: AuditField): boolean {
  return "financial" in AUDIT_FIELDS[field];
}

export function redactChanges(changes: Change[], canViewFinancial: boolean): VisibleChange[] {
  if (canViewFinancial) return changes;
  return changes.map((c) => (isFinancial(c.field) ? { field: c.field, from: null, to: null, hidden: true } : c));
}
