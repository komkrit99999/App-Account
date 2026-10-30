/*
  Warnings:

  - You are about to drop the `ImportBatch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "ImportBatch_userId_createdAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ImportBatch";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileStored" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "headers" TEXT NOT NULL,
    "rows" TEXT NOT NULL,
    "columnMapping" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ImportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerLabel" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "importLogId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportRowError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "ImportRowError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportRowError" ("batchId", "id", "message", "rowNumber") SELECT "batchId", "id", "message", "rowNumber" FROM "ImportRowError";
DROP TABLE "ImportRowError";
ALTER TABLE "new_ImportRowError" RENAME TO "ImportRowError";
CREATE INDEX "ImportRowError_batchId_idx" ON "ImportRowError"("batchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ImportLog_createdAt_idx" ON "ImportLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImportLog_userId_createdAt_idx" ON "ImportLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_customerId_createdAt_idx" ON "AuditLog"("customerId", "createdAt");
