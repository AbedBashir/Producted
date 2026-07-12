import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getCreditStatus } from "../lib/credits.server";
import { TEMPLATE_LIMITS, PLAN_LABELS } from "../lib/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const templates = await db.ruleTemplate.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
  });

  return {
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      ruleChain: JSON.parse(t.ruleChain),
      targetType: t.targetType,
      targetIds: JSON.parse(t.targetIds),
      lastRunAt: t.lastRunAt?.toISOString() ?? null,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json();

  if (body.intent === "save") {
    const {
      name,
      field,
      action: ruleAction,
      value,
      findValue,
      incrementMode,
      conditions,
      targetType,
      targetIds,
    } = body;

    if (!name?.trim()) {
      return { success: false, error: "Template name is required" };
    }

    const credits = await getCreditStatus(session.shop);
    const existingCount = await db.ruleTemplate.count({
      where: { shop: session.shop },
    });
    const limit = TEMPLATE_LIMITS[credits.plan];

    if (existingCount >= limit) {
      return {
        success: false,
        error: `Your ${PLAN_LABELS[credits.plan]} plan allows up to ${limit} saved template${limit === 1 ? "" : "s"}. Upgrade to save more.`,
      };
    }

    const template = await db.ruleTemplate.create({
      data: {
        shop: session.shop,
        name: name.trim(),
        description: `${ruleAction} ${field.label} to "${value}"`,
        ruleChain: JSON.stringify({
          field,
          action: ruleAction,
          value,
          findValue,
          incrementMode,
          conditions,
        }),
        targetType,
        targetIds: JSON.stringify(targetIds ?? []),
      },
    });

    return { success: true, id: template.id };
  }

  if (body.intent === "delete") {
    const template = await db.ruleTemplate.findUnique({
      where: { id: body.id },
    });
    if (!template || template.shop !== session.shop) {
      return { success: false, error: "Template not found" };
    }
    await db.ruleTemplate.delete({ where: { id: body.id } });
    return { success: true };
  }

  if (body.intent === "markRun") {
    const template = await db.ruleTemplate.findUnique({
      where: { id: body.id },
    });
    if (!template || template.shop !== session.shop) {
      return { success: false, error: "Template not found" };
    }
    await db.ruleTemplate.update({
      where: { id: body.id },
      data: { lastRunAt: new Date() },
    });
    return { success: true };
  }

  return { success: false, error: "Unknown intent" };
};
