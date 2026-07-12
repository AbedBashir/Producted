import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const status = payload.app_subscription?.status as string | undefined;
  const name = (
    payload.app_subscription?.name as string | undefined
  )?.toLowerCase();

  if (
    status === "ACTIVE" &&
    name &&
    ["starter", "pro", "advanced"].includes(name)
  ) {
    await db.appSettings.upsert({
      where: { shop },
      update: { plan: name },
      create: { shop, plan: name },
    });
  } else if (
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "DECLINED" ||
    status === "FROZEN"
  ) {
    // Covers cancellations done directly from Shopify's own billing page, not just in-app.
    await db.appSettings.upsert({
      where: { shop },
      update: { plan: "free" },
      create: { shop, plan: "free" },
    });
  }

  return new Response();
};
