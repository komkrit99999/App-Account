-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "projectName" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nameTh" TEXT NOT NULL DEFAULT '',
    "nameEn" TEXT,
    "addressTh" TEXT,
    "addressEn" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "lineId" TEXT,
    "lineOfficial" TEXT,
    "facebook" TEXT,
    "taxId" TEXT,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT true,
    "branchCode" TEXT,
    "headerNote" TEXT,
    "footerNotes" TEXT,
    "invoiceTemplate" TEXT NOT NULL DEFAULT 'red',
    "vatRate" DECIMAL NOT NULL DEFAULT 7,
    "logoMime" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("addressEn", "addressTh", "branchCode", "email", "facebook", "headerNote", "id", "isHeadOffice", "lineId", "logoMime", "nameEn", "nameTh", "phone", "taxId", "updatedAt", "vatRate") SELECT "addressEn", "addressTh", "branchCode", "email", "facebook", "headerNote", "id", "isHeadOffice", "lineId", "logoMime", "nameEn", "nameTh", "phone", "taxId", "updatedAt", "vatRate" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
