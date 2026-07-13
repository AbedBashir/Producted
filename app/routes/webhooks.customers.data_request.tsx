import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Producted does not store or process customer data — nothing to return.
  await authenticate.webhook(request);
  return new Response();
};
