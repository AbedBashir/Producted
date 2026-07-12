import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { evaluateAutomationsForProduct } from "../lib/automation-engine.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, admin } = await authenticate.webhook(request);

  if (admin) {
    const productGid = payload.admin_graphql_api_id as string;
    if (productGid) {
      await evaluateAutomationsForProduct(admin, shop, productGid, "updated");
    }
  }

  return new Response();
};
