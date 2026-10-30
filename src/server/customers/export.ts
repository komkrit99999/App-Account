// Builds the customer export workbook. Pure (no DB), unit-tested.
import * as XLSX from "xlsx";
import { formatDateTime } from "@/lib/format";
import type { CustomerDTO } from "./queries";

type Column = {
  label: string;
  value: (c: CustomerDTO) => string | number | null;
  width: number;
  financial?: boolean;
  /** Keep as text so Excel doesn't strip leading zeros */
  text?: boolean;
  money?: boolean;
};

const num = (v: string | null | undefined) => (v == null ? null : Number(v));

export const EXPORT_COLUMNS: Column[] = [
  { label: "รหัสลูกค้า", value: (c) => c.code, width: 10 },
  { label: "ชื่อลูกค้า", value: (c) => c.name, width: 28 },
  { label: "เบอร์โทร", value: (c) => c.phone, width: 14, text: true },
  { label: "อีเมล", value: (c) => c.email, width: 24 },
  { label: "ที่อยู่", value: (c) => c.address, width: 40 },
  { label: "Facebook", value: (c) => c.facebook, width: 20 },
  { label: "ID LINE", value: (c) => c.lineId, width: 16 },
  { label: "ที่ทำงาน", value: (c) => c.workplace, width: 24 },
  { label: "เบอร์ที่ทำงาน", value: (c) => c.workplacePhone, width: 18, text: true },
  { label: "ชื่อบริษัท", value: (c) => c.companyName, width: 28 },
  { label: "เลขประจำตัวผู้เสียภาษี", value: (c) => c.taxId, width: 16, text: true },
  { label: "รหัสสาขา", value: (c) => (c.taxId ? (c.isHeadOffice ? "00000" : c.branchCode) : null), width: 10, text: true },
  { label: "ผู้ติดต่อ", value: (c) => c.contactPerson, width: 18 },
  { label: "แท็ก", value: (c) => c.tags.map((t) => t.name).join(", ") || null, width: 20 },
  { label: "หมายเหตุ", value: (c) => c.note, width: 30 },
  { label: "วงเงินเครดิต", value: (c) => num(c.financial?.creditLimit), width: 14, financial: true, money: true },
  { label: "เงื่อนไขชำระเงิน (วัน)", value: (c) => c.financial?.paymentTermDays ?? null, width: 12, financial: true },
  { label: "ยอดค้างชำระ", value: (c) => num(c.financial?.outstandingBalance), width: 14, financial: true, money: true },
  { label: "สร้างโดย", value: (c) => c.createdBy, width: 16 },
  { label: "สร้างเมื่อ", value: (c) => formatDateTime(c.createdAt), width: 20 },
  { label: "แก้ไขล่าสุดโดย", value: (c) => c.updatedBy, width: 16 },
  { label: "แก้ไขล่าสุดเมื่อ", value: (c) => formatDateTime(c.updatedAt), width: 20 },
];

export function exportColumnsFor(opts: { includeFinancial: boolean }): Column[] {
  return EXPORT_COLUMNS.filter((col) => opts.includeFinancial || !col.financial);
}

export type ExportMeta = {
  exportedBy: string;
  exportedAt: Date;
  q: string;
  tagNames: string[];
  total: number;
};

export function buildCustomerWorkbook(customers: CustomerDTO[], opts: { includeFinancial: boolean; meta: ExportMeta }): Buffer {
  const columns = exportColumnsFor(opts);

  const ws = XLSX.utils.aoa_to_sheet([columns.map((col) => col.label), ...customers.map((c) => columns.map((col) => col.value(c)))]);
  ws["!cols"] = columns.map((col) => ({ wch: col.width }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: customers.length, c: columns.length - 1 } }) };
  columns.forEach((col, c) => {
    if (!col.text && !col.money) return;
    for (let r = 1; r <= customers.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      if (col.text) {
        cell.t = "s";
        cell.v = String(cell.v);
        cell.z = "@";
      } else {
        cell.z = "#,##0.00";
      }
    }
  });

  const { meta } = opts;
  const info: (string | number)[][] = [
    ["Export โดย", meta.exportedBy],
    ["วันที่ Export", formatDateTime(meta.exportedAt)],
    ["คำค้นหา", meta.q || "(ไม่มี)"],
    ["แท็ก", meta.tagNames.join(", ") || "(ทั้งหมด)"],
    ["จำนวนลูกค้า", customers.length],
  ];
  if (customers.length < meta.total) {
    info.push(["หมายเหตุ", `ตัวกรองนี้มีลูกค้า ${meta.total.toLocaleString("th-TH")} ราย ไฟล์นี้มีเพียง ${customers.length.toLocaleString("th-TH")} รายแรก`]);
  }
  if (!opts.includeFinancial) info.push(["หมายเหตุ", "ไม่รวมคอลัมน์ข้อมูลการเงิน (ไม่มีสิทธิ์ดูข้อมูลการเงิน)"]);
  const infoWs = XLSX.utils.aoa_to_sheet(info);
  infoWs["!cols"] = [{ wch: 16 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ลูกค้า");
  XLSX.utils.book_append_sheet(wb, infoWs, "ข้อมูลการ Export");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
