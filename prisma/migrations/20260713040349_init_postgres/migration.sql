-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "automationsPaused" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleTemplate" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleChain" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetIds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "RuleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledRun" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditHistory" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "ruleChain" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "beforeState" TEXT NOT NULL,
    "afterState" TEXT NOT NULL,
    "runByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "EditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "ruleChain" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedReason" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "Automation_shop_idx" ON "Automation"("shop");

-- AddForeignKey
ALTER TABLE "ScheduledRun" ADD CONSTRAINT "ScheduledRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RuleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
