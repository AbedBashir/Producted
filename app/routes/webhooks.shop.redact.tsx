import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  // This one is real: delete all app-level data for the shop, as required.
  await db.editHistory.deleteMany({ where: { shop } });
  await db.automation.deleteMany({ where: { shop } });
  await db.ruleTemplate.deleteMany({ where: { shop } });
  await db.creditLog.deleteMany({ where: { shop } });
  await db.appSettings.deleteMany({ where: { shop } });

  return new Response();
};
