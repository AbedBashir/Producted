import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await db.appSettings.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });

  return {
    automationsPaused: settings.automationsPaused,
    weeklyDigestEnabled: settings.weeklyDigestEnabled,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json();

  if (body.intent === "toggle-automations-paused") {
    const settings = await db.appSettings.upsert({
      where: { shop: session.shop },
      update: { automationsPaused: body.value },
      create: { shop: session.shop, automationsPaused: body.value },
    });
    return { success: true, automationsPaused: settings.automationsPaused };
  }

  if (body.intent === "toggle-weekly-digest") {
    const settings = await db.appSettings.upsert({
      where: { shop: session.shop },
      update: { weeklyDigestEnabled: body.value },
      create: { shop: session.shop, weeklyDigestEnabled: body.value },
    });
    return { success: true, weeklyDigestEnabled: settings.weeklyDigestEnabled };
  }

  if (body.intent === "clear-history") {
    const result = await db.editHistory.deleteMany({
      where: { shop: session.shop },
    });
    return { success: true, deletedCount: result.count };
  }

  return { success: false, error: "Unknown intent" };
};
