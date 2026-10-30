-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "address" TEXT,
    "note" TEXT,
    "companyName" TEXT,
    "taxId" TEXT,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT true,
    "branchCode" TEXT,
    "contactPerson" TEXT,
    "creditLimit" DECIMAL,
    "paymentTermDays" INTEGER,
    "outstandingBalance" DECIMAL NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomerTag" (
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("customerId", "tagId"),
    CONSTRAINT "CustomerTag_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_name_idx" ON "Customer"("deletedAt", "name");

-- CreateIndex
CREATE INDEX "Customer_phoneNormalized_idx" ON "Customer"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Customer_taxId_branchCode_idx" ON "Customer"("taxId", "branchCode");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "CustomerTag_tagId_idx" ON "CustomerTag"("tagId");
