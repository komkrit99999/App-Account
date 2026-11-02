// Single source of truth for who can do what.
// Client-safe (no server imports): used to hide UI and, via src/lib/authz.ts,
// to enforce on the server. Hiding UI is cosmetic — every server entry point
// must check again.

export const FEATURES = {
  // Tier 1 — every tier can add records
  viewCustomers: "ดูข้อมูลลูกค้า",
  createCustomer: "เพิ่มลูกค้า",
  createLoan: "เพิ่มเงินกู้ (เห็นเฉพาะที่ตัวเองบันทึก ถ้าไม่มีสิทธิ์ดูข้อมูลการเงิน)",
  createInvoice: "ออกใบกำกับภาษี (เห็นเฉพาะที่ตัวเองออก ถ้าไม่มีสิทธิ์ดูข้อมูลการเงิน)",
  importExcel: "นำเข้า Excel/CSV (เพิ่มลูกค้าใหม่เท่านั้น)",
  viewOwnHistory: "ดูประวัติของตัวเอง",
  // Tier 2
  viewFinancial: "ดูข้อมูลการเงิน",
  editFinancial: "กรอกข้อมูลการเงินของลูกค้า",
  exportExcel: "Export เป็น Excel",
  // Tier 3
  viewAllHistory: "ดูประวัติของทุกคน",
  manageTags: "จัดการแท็ก",
  // Admin role (independent of tier) — only admins change or remove existing records
  editCustomer: "แก้ไขลูกค้า (รวมถึงอัปเดตลูกค้าเดิมตอนนำเข้า)",
  deleteCustomer: "ลบลูกค้า",
  bulkDeleteCustomers: "ลบหลายรายการพร้อมกัน",
  editLoan: "แก้ไข / ปิดยอด / เปิดสัญญาเงินกู้อีกครั้ง",
  editInvoice: "แก้ไข / ยกเลิกใบกำกับภาษี",
  manageCompany: "ตั้งค่าข้อมูลบริษัท (ผู้ขายบนใบกำกับภาษี)",
  manageUsers: "จัดการผู้ใช้และ tier",
} as const;

export type Feature = keyof typeof FEATURES;
export type Tier = 1 | 2 | 3;

export const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 · Basic",
  2: "Tier 2 · Standard",
  3: "Tier 3 · Advanced",
};

const TIER_1 = ["viewCustomers", "createCustomer", "createLoan", "createInvoice", "importExcel", "viewOwnHistory"] as const;
const TIER_2 = [...TIER_1, "viewFinancial", "editFinancial", "exportExcel"] as const;
const TIER_3 = [...TIER_2, "viewAllHistory", "manageTags"] as const;

export const TIER_FEATURES: Record<Tier, readonly Feature[]> = {
  1: TIER_1,
  2: TIER_2,
  3: TIER_3,
};

// Granted on top of the user's tier features
export const ADMIN_FEATURES: readonly Feature[] = [
  "editCustomer",
  "deleteCustomer",
  "bulkDeleteCustomers",
  "editLoan",
  "editInvoice",
  "manageCompany",
  "manageUsers",
  "viewAllHistory",
];

export type PermissionSubject = { role: string; tier: number };

export function featuresOf(user: PermissionSubject | null | undefined): Feature[] {
  if (!user) return [];
  // Unknown tier → nothing (fail closed)
  const tierFeatures = TIER_FEATURES[user.tier as Tier] ?? [];
  return user.role === "ADMIN" ? [...tierFeatures, ...ADMIN_FEATURES] : [...tierFeatures];
}

export function can(user: PermissionSubject | null | undefined, feature: Feature): boolean {
  return featuresOf(user).includes(feature);
}
