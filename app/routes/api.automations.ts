import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum } from "../lib/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const automations = await db.automation.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return {
    automations: automations.map((a) => ({
      id: a.id,
      name: a.name,
      triggerEvent: a.triggerEvent,
      rules: JSON.parse(a.ruleChain),
      conditions: JSON.parse(a.conditions),
      active: a.active,
      paused: a.paused,
      pausedReason: a.pausedReason,
      runCount: a.runCount,
      lastRunAt: a.lastRunAt?.toISOString() ?? null,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json();
  const credits = await getCreditStatus(session.shop);

  if (body.intent === "create") {
    if (!planMeetsMinimum(credits.plan, "pro")) {
      return {
        success: false,
        error: "Automation requires the Pro plan or higher.",
      };
    }

    const activeCount = await db.automation.count({
      where: { shop: session.shop, active: true },
    });
    if (credits.plan === "pro" && activeCount >= 1) {
      return {
        success: false,
        error:
          "The Pro plan allows 1 active automation. Upgrade to Advanced for unlimited.",
      };
    }

    const { name, triggerEvent, rules, conditions } = body;

    if (!rules || rules.length === 0) {
      return { success: false, error: "At least one rule step is required." };
    }

    const automation = await db.automation.create({
      data: {
        shop: session.shop,
        name:
          name?.trim() ||
          `${triggerEvent === "created" ? "On create" : "On update"}: ${rules[0].field.label}`,
        triggerEvent,
        ruleChain: JSON.stringify(rules),
        conditions: JSON.stringify(conditions ?? []),
      },
    });

    return { success: true, id: automation.id };
  }

  if (body.intent === "update") {
    const automation = await db.automation.findUnique({
      where: { id: body.id },
    });
    if (!automation || automation.shop !== session.shop) {
      return { success: false, error: "Automation not found" };
    }

    const { name, triggerEvent, rules, conditions } = body;
    if (!rules || rules.length === 0) {
      return { success: false, error: "At least one rule step is required." };
    }

    await db.automation.update({
      where: { id: body.id },
      data: {
        name: name?.trim() || automation.name,
        triggerEvent,
        ruleChain: JSON.stringify(rules),
        conditions: JSON.stringify(conditions ?? []),
      },
    });

    return { success: true };
  }

  if (body.intent === "toggle") {
    const automation = await db.automation.findUnique({
      where: { id: body.id },
    });
    if (!automation || automation.shop !== session.shop) {
      return { success: false, error: "Automation not found" };
    }

    await db.automation.update({
      where: { id: body.id },
      data: {
        active: !automation.active,
        paused: automation.active ? automation.paused : false,
        pausedReason: automation.active ? automation.pausedReason : null,
      },
    });

    return { success: true };
  }

  if (body.intent === "delete") {
    const automation = await db.automation.findUnique({
      where: { id: body.id },
    });
    if (!automation || automation.shop !== session.shop) {
      return { success: false, error: "Automation not found" };
    }
    await db.automation.delete({ where: { id: body.id } });
    return { success: true };
  }

  return { success: false, error: "Unknown intent" };
};
