import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // No shop context at all — kick off the standard install/login flow,
  // which itself lands the merchant in /app once authenticated.
  throw await login(request);
};

export default function Index() {
  return null;
}
