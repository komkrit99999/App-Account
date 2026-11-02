/*
  Warnings:

  - You are about to drop the column `invoiceNumberFormat` on the `CompanySettings` table. All the data in the column will be lost.
  - You are about to drop the column `numberPeriod` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `runningNo` on the `Invoice` table. All the data in the column will be lost.

*/
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
    "facebook" TEXT,
    "taxId" TEXT,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT true,
    "branchCode" TEXT,
    "headerNote" TEXT,
    "vatRate" DECIMAL NOT NULL DEFAULT 7,
    "logoMime" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("addressEn", "addressTh", "branchCode", "email", "facebook", "headerNote", "id", "isHeadOffice", "lineId", "logoMime", "nameEn", "nameTh", "phone", "taxId", "updatedAt", "vatRate") SELECT "addressEn", "addressTh", "branchCode", "email", "facebook", "headerNote", "id", "isHeadOffice", "lineId", "logoMime", "nameEn", "nameTh", "phone", "taxId", "updatedAt", "vatRate" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "salesperson" TEXT,
    "paymentTerm" TEXT,
    "remark" TEXT,
    "customerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerBranch" TEXT,
    "buyerAddress" TEXT,
    "buyerTaxId" TEXT,
    "seller" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "vatRate" DECIMAL NOT NULL,
    "vatAmount" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("buyerAddress", "buyerBranch", "buyerName", "buyerTaxId", "cancelledAt", "createdAt", "createdById", "customerId", "dueDate", "id", "issueDate", "number", "paymentTerm", "remark", "salesperson", "seller", "seq", "status", "subtotal", "total", "updatedAt", "updatedById", "vatAmount", "vatRate") SELECT "buyerAddress", "buyerBranch", "buyerName", "buyerTaxId", "cancelledAt", "createdAt", "createdById", "customerId", "dueDate", "id", "issueDate", "number", "paymentTerm", "remark", "salesperson", "seller", "seq", "status", "subtotal", "total", "updatedAt", "updatedById", "vatAmount", "vatRate" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_seq_key" ON "Invoice"("seq");
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_createdById_issueDate_idx" ON "Invoice"("createdById", "issueDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
