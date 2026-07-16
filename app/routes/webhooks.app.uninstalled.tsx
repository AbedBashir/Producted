import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session } = await authenticate.webhook(request);

  // Hard reset on uninstall — don't rely solely on subscriptions_update,
  // since Shopify's cancellation webhook isn't guaranteed to arrive
  // before/during reinstall.
  await db.appSettings.upsert({
    where: { shop },
    update: { plan: "free" },
    create: { shop, plan: "free" },
  });

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
