// Customer fields a spreadsheet column can be mapped to. Client-safe.

type FieldDef = {
  label: string;
  required?: boolean;
  financial?: boolean;
  hint: string;
  example: string;
  /** Header texts recognised automatically (compared after normalizeHeader) */
  aliases: string[];
};

export const IMPORT_FIELDS = {
  name: {
    label: "ชื่อลูกค้า",
    required: true,
    hint: "จำเป็นต้องกรอก",
    example: "บริษัท ตัวอย่าง จำกัด",
    aliases: ["ชื่อ", "ชื่อลูกค้า", "ลูกค้า", "name", "customer", "customer name"],
  },
  phone: {
    label: "เบอร์โทร",
    hint: "ใส่ขีดหรือเว้นวรรคได้",
    example: "081-234-5678",
    aliases: ["เบอร์โทร", "เบอร์โทรศัพท์", "โทรศัพท์", "เบอร์", "มือถือ", "phone", "tel", "telephone", "mobile"],
  },
  email: {
    label: "อีเมล",
    hint: "",
    example: "contact@example.com",
    aliases: ["อีเมล", "อีเมล์", "email", "e-mail"],
  },
  address: {
    label: "ที่อยู่",
    hint: "",
    example: "99 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
    aliases: ["ที่อยู่", "address"],
  },
  note: { label: "หมายเหตุ", hint: "", example: "", aliases: ["หมายเหตุ", "note", "notes", "remark", "remarks"] },
  companyName: {
    label: "ชื่อบริษัท",
    hint: "",
    example: "Example Co., Ltd.",
    aliases: ["ชื่อบริษัท", "บริษัท", "company", "company name"],
  },
  taxId: {
    label: "เลขประจำตัวผู้เสียภาษี",
    hint: "ตัวเลข 13 หลัก ใช้ตรวจข้อมูลซ้ำ",
    example: "0105536009604",
    aliases: ["เลขประจำตัวผู้เสียภาษี", "เลขผู้เสียภาษี", "เลขภาษี", "เลขประจำตัวผู้เสียภาษีอากร", "tax id", "taxid", "tax no", "tax number"],
  },
  branch: {
    label: "รหัสสาขา",
    hint: "เว้นว่างหรือ 00000 = สำนักงานใหญ่, สาขาใส่ตัวเลข 5 หลัก",
    example: "00000",
    aliases: ["รหัสสาขา", "สาขา", "สำนักงานใหญ่/สาขา", "branch", "branch code", "branch no"],
  },
  contactPerson: {
    label: "ผู้ติดต่อ",
    hint: "",
    example: "คุณสมศรี ใจดี",
    aliases: ["ผู้ติดต่อ", "ชื่อผู้ติดต่อ", "contact", "contact person", "contact name"],
  },
  creditLimit: {
    label: "วงเงินเครดิต",
    financial: true,
    hint: "บาท (Tier 2 ขึ้นไป)",
    example: "100000",
    aliases: ["วงเงินเครดิต", "วงเงิน", "credit limit"],
  },
  paymentTermDays: {
    label: "เงื่อนไขชำระเงิน (วัน)",
    financial: true,
    hint: "จำนวนวัน 0–365 (Tier 2 ขึ้นไป)",
    example: "30",
    aliases: ["เงื่อนไขชำระเงิน (วัน)", "เงื่อนไขชำระเงิน", "เครดิต (วัน)", "เครดิตเทอม", "credit term", "payment term", "payment terms"],
  },
  outstandingBalance: {
    label: "ยอดค้างชำระ",
    financial: true,
    hint: "บาท (Tier 2 ขึ้นไป)",
    example: "0",
    aliases: ["ยอดค้างชำระ", "ยอดค้าง", "outstanding", "outstanding balance", "balance"],
  },
} satisfies Record<string, FieldDef>;

export type ImportField = keyof typeof IMPORT_FIELDS;

/** column index → field */
export type ColumnMapping = Record<number, ImportField>;

export function importFieldsFor(opts: { canEditFinancial: boolean }): ImportField[] {
  return (Object.keys(IMPORT_FIELDS) as ImportField[]).filter(
    (f) => opts.canEditFinancial || !(IMPORT_FIELDS[f] as FieldDef).financial,
  );
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

export function guessMapping(headers: string[], allowed: ImportField[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<ImportField>();
  headers.forEach((header, i) => {
    const h = normalizeHeader(header);
    const field = allowed.find((f) => !used.has(f) && IMPORT_FIELDS[f].aliases.some((a) => normalizeHeader(a) === h));
    if (field) {
      mapping[i] = field;
      used.add(field);
    }
  });
  return mapping;
}
