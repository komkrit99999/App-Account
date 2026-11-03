-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Move the single seller row over (keeps id 1, so its logo and invoices line up)
INSERT INTO "Company" ("id", "nameTh", "nameEn", "addressTh", "addressEn", "phone", "email", "lineId", "lineOfficial", "facebook", "taxId", "isHeadOffice", "branchCode", "headerNote", "footerNotes", "invoiceTemplate", "vatRate", "logoMime", "updatedAt") SELECT "id", "nameTh", "nameEn", "addressTh", "addressEn", "phone", "email", "lineId", "lineOfficial", "facebook", "taxId", "isHeadOffice", "branchCode", "headerNote", "footerNotes", "invoiceTemplate", "vatRate", "logoMime", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
-- Invoices must belong to a company; should any exist without one, give them a placeholder to rename
INSERT INTO "Company" ("id", "nameTh", "updatedAt")
SELECT 1, '(บริษัทเดิม)', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Company") AND EXISTS (SELECT 1 FROM "Invoice");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "salesperson" TEXT,
    "projectName" TEXT,
    "paymentTerm" TEXT,
    "remark" TEXT,
    "customerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerBranch" TEXT,
    "buyerAddress" TEXT,
    "buyerTaxId" TEXT,
    "companyId" INTEGER NOT NULL,
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
    CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("buyerAddress", "buyerBranch", "buyerName", "buyerTaxId", "cancelledAt", "createdAt", "createdById", "customerId", "dueDate", "id", "issueDate", "number", "paymentTerm", "projectName", "remark", "salesperson", "seller", "seq", "status", "subtotal", "total", "updatedAt", "updatedById", "vatAmount", "vatRate", "companyId") SELECT "buyerAddress", "buyerBranch", "buyerName", "buyerTaxId", "cancelledAt", "createdAt", "createdById", "customerId", "dueDate", "id", "issueDate", "number", "paymentTerm", "projectName", "remark", "salesperson", "seller", "seq", "status", "subtotal", "total", "updatedAt", "updatedById", "vatAmount", "vatRate", (SELECT MIN("id") FROM "Company") FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_seq_key" ON "Invoice"("seq");
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_createdById_issueDate_idx" ON "Invoice"("createdById", "issueDate");
CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "Invoice"("companyId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

