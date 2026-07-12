import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json();

  if (body.intent === "clear-automations") {
    const result = await db.automation.deleteMany({
      where: { shop: session.shop },
    });
    return { success: true, deletedCount: result.count };
  }

  if (body.intent === "clear-templates") {
    const result = await db.ruleTemplate.deleteMany({
      where: { shop: session.shop },
    });
    return { success: true, deletedCount: result.count };
  }

  return { success: false, error: "Unknown intent" };
};
