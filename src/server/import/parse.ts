import * as XLSX from "xlsx";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;
const MAX_COLUMNS = 50;

export type Sheet = { headers: string[]; rows: string[][] };

/** Reads the first sheet of an .xlsx/.xls/.csv file. Row 1 is the header. */
export function parseSpreadsheet(buf: Buffer, fileName: string): Sheet | { error: string } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = fileName.toLowerCase().endsWith(".csv")
      ? XLSX.read(decodeCsv(buf), { type: "string", raw: true })
      : XLSX.read(buf, { type: "buffer" });
  } catch {
    return { error: "อ่านไฟล์ไม่ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง" };
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { error: "ไม่พบชีตในไฟล์" };

  // raw: true keeps numbers as numbers — formatted text can turn long IDs into "1.05E+12"
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: false });
  if (table.length === 0) return { error: "ไฟล์ว่างเปล่า" };

  const width = Math.min(Math.max(...table.map((r) => r.length)), MAX_COLUMNS);
  const headers = Array.from({ length: width }, (_, i) => cellText(table[0][i]) || `คอลัมน์ ${i + 1}`);
  const rows = table
    .slice(1)
    .map((r) => Array.from({ length: width }, (_, i) => cellText(r[i])))
    .filter((r) => r.some((c) => c !== ""));

  if (rows.length === 0) return { error: "ไม่พบข้อมูล (แถวแรกต้องเป็นหัวคอลัมน์ ข้อมูลเริ่มแถวที่ 2)" };
  if (rows.length > MAX_ROWS) {
    return { error: `ไฟล์มี ${rows.length.toLocaleString("th-TH")} แถว เกินขีดจำกัด ${MAX_ROWS.toLocaleString("th-TH")} แถวต่อครั้ง` };
  }
  return { headers, rows };
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

/** UTF-8 (with or without BOM), falling back to Thai Windows-874 as saved by older Excel */
function decodeCsv(buf: Buffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-874").decode(buf);
}
