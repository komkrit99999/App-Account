-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "facebook" TEXT;
ALTER TABLE "Customer" ADD COLUMN "lineId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "workplace" TEXT;
ALTER TABLE "Customer" ADD COLUMN "workplacePhone" TEXT;

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "principal" DECIMAL NOT NULL,
    "interestRatePerYear" DECIMAL NOT NULL,
    "interestDueDay" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "principalDueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "closedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Loan_status_interestDueDay_idx" ON "Loan"("status", "interestDueDay");

-- CreateIndex
CREATE INDEX "Loan_customerId_idx" ON "Loan"("customerId");
