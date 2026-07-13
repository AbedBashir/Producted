import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Producted does not store customer data — nothing to redact.
  await authenticate.webhook(request);
  return new Response();
};
