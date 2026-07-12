-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RuleTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleChain" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastRunAt" DATETIME
);

-- CreateTable
CREATE TABLE "ScheduledRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RuleTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "ruleChain" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "beforeState" TEXT NOT NULL,
    "afterState" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

-- CreateIndex
CREATE INDEX "CreditLog_shop_idx" ON "CreditLog"("shop");

-- CreateIndex
CREATE INDEX "RuleTemplate_shop_idx" ON "RuleTemplate"("shop");

-- CreateIndex
CREATE INDEX "ScheduledRun_shop_idx" ON "ScheduledRun"("shop");

-- CreateIndex
CREATE INDEX "EditHistory_shop_idx" ON "EditHistory"("shop");
