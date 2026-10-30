import * as XLSX from "xlsx";
import { withFeature } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { IMPORT_FIELDS, importFieldsFor, type ImportField } from "@/lib/import-fields";

// Columns that must stay text so Excel doesn't strip leading zeros
const TEXT_FIELDS: ImportField[] = ["phone", "taxId", "branch"];

const SECOND_EXAMPLE: Partial<Record<ImportField, string>> = {
  name: "ร้านสมชายการค้า",
  phone: "0812345678",
  address: "12 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
  taxId: "3100100123451",
  contactPerson: "คุณสมชาย",
  creditLimit: "20000",
  paymentTermDays: "15",
  outstandingBalance: "1200.50",
};

// Financial columns only appear for users allowed to import them
export const GET = withFeature("importExcel", async (_req, _ctx, user) => {
  const fields = importFieldsFor({ canEditFinancial: can(user, "editFinancial") });

  const aoa = [
    fields.map((f) => IMPORT_FIELDS[f].label),
    fields.map((f) => IMPORT_FIELDS[f].example),
    fields.map((f) => SECOND_EXAMPLE[f] ?? ""),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = fields.map((f) => ({ wch: Math.max(14, IMPORT_FIELDS[f].label.length + 4) }));
  fields.forEach((f, c) => {
    if (!TEXT_FIELDS.includes(f)) return;
    // Format the whole column (rows 2–1000) as text
    for (let r = 1; r <= 1000; r++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref] ?? (ws[ref] = { t: "s", v: "" });
      cell.t = "s";
      cell.z = "@";
    }
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 1000, c: fields.length - 1 } });

  const help = XLSX.utils.aoa_to_sheet([
    ["คอลัมน์", "จำเป็น", "คำอธิบาย"],
    ...fields.map((f) => [IMPORT_FIELDS[f].label, f === "name" ? "✓" : "", IMPORT_FIELDS[f].hint]),
    [],
    ["• แถวแรกต้องเป็นหัวคอลัมน์ ข้อมูลเริ่มแถวที่ 2 (ลบแถวตัวอย่างก่อนนำเข้า)"],
    ["• ระบบตรวจข้อมูลซ้ำจากเลขประจำตัวผู้เสียภาษี + รหัสสาขา หรือเบอร์โทร"],
    ["• สลับลำดับคอลัมน์หรือเปลี่ยนชื่อหัวคอลัมน์ได้ จับคู่เองได้ในหน้านำเข้า"],
  ]);
  help["!cols"] = [{ wch: 26 }, { wch: 8 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ลูกค้า");
  XLSX.utils.book_append_sheet(wb, help, "คำอธิบาย");
  const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="customer-import-template.xlsx"; filename*=UTF-8''${encodeURIComponent("แม่แบบนำเข้าลูกค้า.xlsx")}`,
      "Cache-Control": "no-store",
    },
  });
});
