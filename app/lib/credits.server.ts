import db from "../db.server";
import { PLAN_CREDITS, type PlanKey } from "./plans";

export async function getOrCreateAppSettings(shop: string) {
  let settings = await db.appSettings.findUnique({ where: { shop } });
  if (!settings) {
    settings = await db.appSettings.create({ data: { shop, plan: "free" } });
  }
  return settings;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getCreditsUsedThisMonth(shop: string): Promise<number> {
  const logs = await db.creditLog.findMany({
    where: {
      shop,
      reason: "edit_execution",
      createdAt: { gte: startOfMonth() },
    },
  });
  // Spends are stored as negative amounts; sum their absolute value.
  return logs.reduce((sum, log) => sum + Math.abs(log.amount), 0);
}

export async function getCreditStatus(shop: string) {
  const settings = await getOrCreateAppSettings(shop);
  const plan = (settings.plan as PlanKey) ?? "free";
  const total = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;
  const used = await getCreditsUsedThisMonth(shop);
  return { plan, total, used, remaining: Math.max(total - used, 0) };
}

export async function spendCredit(shop: string, reason = "edit_execution") {
  await db.creditLog.create({
    data: { shop, amount: -1, reason },
  });
}
