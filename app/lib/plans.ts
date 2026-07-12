export type PlanKey = "free" | "starter" | "pro" | "advanced";

export const PLAN_CREDITS: Record<PlanKey, number> = {
  free: 5,
  starter: 60,
  pro: 400,
  advanced: 2500,
};

export const PLAN_LABELS: Record<PlanKey, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  advanced: "Advanced",
};

export const TEMPLATE_LIMITS: Record<PlanKey, number> = {
  free: 1,
  starter: 5,
  pro: Infinity,
  advanced: Infinity,
};

export const PLAN_ORDER: PlanKey[] = ["free", "starter", "pro", "advanced"];

export function planMeetsMinimum(current: PlanKey, min: PlanKey): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(min);
}

export function isValidPlan(plan: string): plan is PlanKey {
  return plan in PLAN_CREDITS;
}
