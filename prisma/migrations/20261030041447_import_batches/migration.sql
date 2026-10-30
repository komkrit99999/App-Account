-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
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
    CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRowError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "ImportRowError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRowError_batchId_idx" ON "ImportRowError"("batchId");
