-- CreateTable
CREATE TABLE "ExportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "includesFinancial" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExportLog_createdAt_idx" ON "ExportLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExportLog_userId_createdAt_idx" ON "ExportLog"("userId", "createdAt");
