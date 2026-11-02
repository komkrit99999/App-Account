// npm run db:backup [-- <output dir>]
// Consistent snapshot of the SQLite DB (safe while the app is running) plus the
// original import files, into backups/<timestamp>/ by default.
import "dotenv/config";
import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("ต้องตั้งค่า DATABASE_URL ใน .env");

const pad = (n: number) => String(n).padStart(2, "0");
const d = new Date();
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const outDir = path.resolve(process.argv[2] ?? path.join("backups", stamp));
const dbOut = path.join(outDir, "app.db");
if (existsSync(dbOut)) throw new Error(`มีไฟล์ ${dbOut} อยู่แล้ว`);
mkdirSync(outDir, { recursive: true });

async function main() {
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: url! }) });
  try {
    // VACUUM INTO writes a transactionally consistent copy, unlike copying the file
    await db.$executeRawUnsafe(`VACUUM INTO '${dbOut.replace(/'/g, "''")}'`);
  } finally {
    await db.$disconnect();
  }
  console.log(`ฐานข้อมูล → ${dbOut} (${(statSync(dbOut).size / 1024).toFixed(0)} KB)`);

  const folders: [string, string, string][] = [
    [process.env.IMPORT_STORAGE_DIR ?? path.join("storage", "imports"), "imports", "ไฟล์นำเข้าต้นฉบับ"],
    [process.env.COMPANY_STORAGE_DIR ?? path.join("storage", "company"), "company", "โลโก้บริษัท"],
  ];
  for (const [src, name, label] of folders) {
    if (!existsSync(src)) continue;
    cpSync(src, path.join(outDir, name), { recursive: true });
    console.log(`${label} → ${path.join(outDir, name)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
