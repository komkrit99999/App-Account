# ระบบข้อมูลลูกค้า

Next.js 16 · TypeScript · Prisma 7 + SQLite · Auth.js v5 (credentials) · Tailwind 4

## เริ่มต้นใช้งาน

```bash
npm install                 # รัน prisma generate ให้อัตโนมัติ
cp .env.example .env        # แล้วใส่ AUTH_SECRET และ SEED_ADMIN_PASSWORD
npm run db:migrate          # สร้างฐานข้อมูล prisma/dev.db
npm run db:seed             # สร้าง admin คนแรก (ถ้ามีอยู่แล้วจะข้าม)
npm run dev                 # http://localhost:3000
```

### ใบกำกับภาษี

1. admin ตั้งค่าข้อมูลบริษัทผู้ขายที่ **ตั้งค่าบริษัท** (`/settings/company`) ก่อน: ชื่อ ที่อยู่ เลขผู้เสียภาษี โลโก้ อักษรนำหน้าเลขที่ และอัตรา VAT
2. ออกใบกำกับได้จากเมนู **ใบกำกับภาษี** หรือปุ่มในหน้าลูกค้า แล้วกด **พิมพ์** (เลือกต้นฉบับ/สำเนาได้)

- เลขที่: `<อักษรนำหน้า>-<เดือน><ปี ค.ศ.>/<เลขรัน 5 หลัก>` เช่น `INV-102026/00001` รันต่อเนื่องไม่ซ้ำ
- ยอดเงิน VAT และจำนวนเงินตัวหนังสือคำนวณที่เซิร์ฟเวอร์ (`src/lib/invoice.ts`) เป็นหน่วยสตางค์ ไม่มีปัดเศษคลาด
- ใบที่ออกแล้วเก็บข้อมูลผู้ซื้อ ผู้ขาย และอัตรา VAT ณ วันที่ออก แก้ข้อมูลลูกค้า/บริษัทภายหลังไม่กระทบใบเดิม
- ทุก tier ออกใบได้ (tier 1 เห็นเฉพาะใบที่ตัวเองออก) · แก้ไข/ยกเลิกได้เฉพาะ admin · ยกเลิกแล้วเลขที่ไม่ถูกนำกลับมาใช้

### ระบบเงินกู้ (ปิดไว้)

หน้าเงินกู้ (`/loans`) และส่วนเงินกู้ในหน้าลูกค้าถูกปิดไว้ โค้ด ตาราง `Loan` และข้อมูลเดิมยังอยู่ครบ
เปิดใช้โดยใส่ `FEATURE_LOANS="1"` ใน `.env` แล้วรีสตาร์ทแอป (สวิตช์อยู่ที่ `src/lib/features.ts`)

## โครงสร้างหลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `src/auth.config.ts` | config ที่ไม่แตะ DB ใช้ร่วมกับ proxy |
| `src/auth.ts` | Credentials provider (ตรวจรหัสผ่านด้วย bcrypt และเช็ค `isActive`) |
| `src/proxy.ts` | redirect ไป `/login` ถ้ายังไม่ล็อกอิน (เป็นการเช็คเบื้องต้นเท่านั้น) |
| `src/lib/dal.ts` | `getCurrentUser()` / `requireAdmin()` อ่าน role/tier จาก DB ทุก request |
| `src/lib/permissions.ts` | ตารางสิทธิ์ tier × ฟีเจอร์ และฟังก์ชัน `can()` — เพิ่มข้อมูลได้ทุก tier, แก้ไข/ลบได้เฉพาะ role ADMIN |
| `src/lib/loan.ts` | เพดานดอกเบี้ย `MAX_INTEREST_RATE_PER_YEAR` (15% ต่อปี) และการคำนวณดอกเบี้ยต่อเดือน |

JWT เก็บแค่ user id ส่วน role, tier และสถานะบัญชีอ่านจาก DB ทุกครั้ง
admin จึงเปลี่ยน tier หรือปิดบัญชีได้โดยมีผลทันที

## การทดสอบ

```bash
npm test                                          # รันทุกเทสต์ (ประมาณ 2 วินาที)
node --import tsx --experimental-test-module-mocks --test src/test/import.int.test.ts   # รันเฉพาะไฟล์
```

ไม่ต้องเปิด dev server และไม่แตะ `prisma/dev.db` เทสต์แต่ละไฟล์สร้างฐานข้อมูล SQLite ชั่วคราวใน temp folder
รัน migration ชุดเดียวกับของจริง แล้วลบทิ้งเมื่อจบ

| ไฟล์ | ตรวจอะไร |
|---|---|
| `src/lib/permissions.test.ts` | ตาราง tier × ฟีเจอร์ตรงตามสเปก และทุก API route / server action มีการตรวจสิทธิ์ |
| `src/test/api-permissions.int.test.ts` | เรียก API และ server action ตรงๆ ในฐานะผู้ใช้แต่ละ tier: tier 1 ไม่ได้รับข้อมูลการเงินจาก `/api/customers`, `/api/customers/:id` ไม่ว่าจะส่ง query อะไรมา, Export ไม่ได้ (403); tier 2 เห็นและ Export ได้; แก้ไข/ลบลูกค้าได้เฉพาะ admin; ยังไม่ล็อกอิน/บัญชีถูกปิด ได้ 401; เปลี่ยน tier แล้วมีผลทันที |
| `src/test/import.int.test.ts` | นำเข้า Excel ครบขั้นตอน (อัปโหลด → วิเคราะห์ → ยืนยัน): แยกแถวใหม่/ซ้ำ/ผิด, อัปเดตแถวซ้ำ, บันทึกประวัติ, กดยืนยันซ้ำพร้อมกันไม่นำเข้าซ้ำ, tier 1 ส่งคอลัมน์การเงินมาเองก็ไม่ถูกบันทึก, คนอื่นยืนยันชุดนำเข้าของเราไม่ได้ |
| `src/test/loans.int.test.ts` | เงินกู้: ทุก tier เพิ่มได้, ดอกเบี้ยเกินร้อยละ 15 ต่อปีบันทึกไม่ได้ (รวมถึง admin), tier 1 เห็นเฉพาะที่ตัวเองบันทึก, แก้ไข/ปิดยอดได้เฉพาะ admin |
| `src/test/invoices.int.test.ts` | ใบกำกับภาษี: ต้องตั้งค่าบริษัทก่อน, ยอดคำนวณที่เซิร์ฟเวอร์ (ตรงกับใบจริง 118,834.20), เลขที่ไม่ซ้ำแม้กดพร้อมกัน, เห็นเฉพาะของตัวเองใน tier 1, แก้ไข/ยกเลิกเฉพาะ admin, ใบเดิมคงอัตรา VAT และข้อมูลผู้ขายเดิม |
| `src/server/**/*.test.ts` | ฟังก์ชันล้วน: อ่านไฟล์ Excel/CSV, จัดประเภทแถว, diff ประวัติ, ไฟล์ Export, ตรวจเลขภาษี |

เทสต์ `*.int.test.ts` เรียก route handler และ server action ตัวจริงกับฐานข้อมูลจริง
ส่วนที่จำลองมีแค่ session (`@/auth`) กับ `redirect()`/`forbidden()`/`revalidatePath()` ของ Next.js
(ดู `src/test/harness.ts`) การอ่าน role/tier จาก DB และการตรวจสิทธิ์ทั้งหมดทำงานตามจริง

## สำรองและกู้คืนข้อมูล

ข้อมูลทั้งหมดอยู่ 2 ที่ ต้องสำรองคู่กัน

- `prisma/dev.db` (หรือไฟล์ตาม `DATABASE_URL`): ลูกค้า ผู้ใช้ ประวัติ
- `storage/imports/` (หรือ `IMPORT_STORAGE_DIR`): ไฟล์ Excel ต้นฉบับที่ผู้ใช้อัปโหลด
- `storage/company/` (หรือ `COMPANY_STORAGE_DIR`): โลโก้บริษัทบนใบกำกับภาษี

### สำรอง

```bash
npm run db:backup                      # → backups/<วันที่-เวลา>/app.db, imports/ และ company/
npm run db:backup -- /Volumes/USB/bk   # เลือกปลายทางเอง
```

สั่งได้ขณะแอปเปิดอยู่ สคริปต์ใช้ `VACUUM INTO` ของ SQLite ซึ่งได้สำเนาที่สมบูรณ์ ณ จุดเวลาเดียว
ส่วนการ `cp` ไฟล์ `.db` ตรงๆ ระหว่างที่มีคนบันทึกข้อมูลอยู่ อาจได้ไฟล์ที่เสีย

ตรวจไฟล์สำรอง: `sqlite3 backups/<วันที่-เวลา>/app.db "pragma integrity_check"` ต้องได้ `ok`

สำรองอัตโนมัติทุกวันตอนตี 2 ด้วย cron (`crontab -e`):

```
0 2 * * * cd "/path/to/App Account" && npm run db:backup >> backups/backup.log 2>&1
```

ไฟล์สำรองมีข้อมูลการเงินและรหัสผ่าน (แบบ hash) ของทุกคน ควรเก็บไว้นอกเครื่องในที่ที่จำกัดสิทธิ์
และลบชุดเก่าเป็นระยะ โฟลเดอร์ `backups/` อยู่ใน `.gitignore` แล้ว

### กู้คืน

```bash
# 1. หยุดแอปก่อน (Ctrl+C ที่ npm run dev / npm start)
# 2. เก็บของปัจจุบันไว้เผื่อ แล้ววางไฟล์สำรองทับ
mv prisma/dev.db prisma/dev.db.before-restore
rm -f prisma/dev.db-wal prisma/dev.db-shm
cp backups/<วันที่-เวลา>/app.db prisma/dev.db
rm -rf storage/imports && cp -R backups/<วันที่-เวลา>/imports storage/imports   # ถ้ามี
rm -rf storage/company && cp -R backups/<วันที่-เวลา>/company storage/company   # ถ้ามี
# 3. ถ้าไฟล์สำรองเก่ากว่าโค้ด ให้รัน migration ที่ขาดไป แล้วเปิดแอป
npx prisma migrate deploy
npm run dev
```
