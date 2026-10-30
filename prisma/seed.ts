import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("ต้องตั้งค่า SEED_ADMIN_USERNAME และ SEED_ADMIN_PASSWORD ใน .env");
  }

  await seedTags();

  // Only create if missing — re-running seed never resets an existing admin's password
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`มีผู้ใช้ "${username}" อยู่แล้ว — ข้าม`);
    return;
  }

  await db.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      displayName: "ผู้ดูแลระบบ",
      role: "ADMIN",
      tier: 3,
    },
  });
  console.log(`สร้าง admin "${username}" เรียบร้อย`);
}

async function seedTags() {
  if ((await db.tag.count()) > 0) return;
  await db.tag.createMany({
    data: [
      { name: "ลูกค้าประจำ", color: "green" },
      { name: "VIP", color: "amber" },
      { name: "ขายส่ง", color: "blue" },
      { name: "ติดตามหนี้", color: "red" },
    ],
  });
  console.log("สร้างแท็กเริ่มต้น 4 แท็ก");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
