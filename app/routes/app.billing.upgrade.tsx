import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, IS_TEST_CHARGE } from "../shopify.server";
import db from "../db.server";
import { isValidPlan } from "../lib/plans";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const targetPlan = formData.get("plan") as string;

  const url = new URL(request.url);
  const origin = `https://${url.host}`;

  if (targetPlan === "free") {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: ["starter", "pro", "advanced"],
      isTest: IS_TEST_CHARGE,
    });

    if (hasActivePayment) {
      for (const sub of appSubscriptions) {
        await billing.cancel({
          subscriptionId: sub.id,
          isTest: IS_TEST_CHARGE,
          prorate: true,
        });
      }
    }

    await db.appSettings.upsert({
      where: { shop: session.shop },
      update: { plan: "free" },
      create: { shop: session.shop, plan: "free" },
    });

    return { success: true };
  }

  if (!isValidPlan(targetPlan) || targetPlan === "free") {
    return { success: false, error: "Invalid plan" };
  }

  return billing.request({
    plan: targetPlan,
    isTest: IS_TEST_CHARGE,
    returnUrl: `${origin}/app/plans?upgraded=${targetPlan}`,
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
