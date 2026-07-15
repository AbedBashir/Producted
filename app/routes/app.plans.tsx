import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, IS_TEST_CHARGE } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { isValidPlan, PLAN_ORDER, type PlanKey } from "../lib/plans";
import db from "../db.server";
import "../styles/shared.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const upgraded = url.searchParams.get("upgraded");
  const host = url.searchParams.get("host") ?? "";

  if (upgraded && isValidPlan(upgraded) && upgraded !== "free") {
    const { hasActivePayment } = await billing.check({
      plans: [upgraded as "starter" | "pro" | "advanced"],
      isTest: IS_TEST_CHARGE,
    });
    if (hasActivePayment) {
      await db.appSettings.upsert({
        where: { shop: session.shop },
        update: { plan: upgraded },
        create: { shop: session.shop, plan: upgraded },
      });
    }
  }

  const credits = await getCreditStatus(session.shop);
  return {
    currentPlan: credits.plan,
    justUpgraded: upgraded && isValidPlan(upgraded) ? upgraded : null,
    isTestCharge: IS_TEST_CHARGE,
    host,
  };
};

interface PlanFeature {
  label: string;
  included: PlanKey[];
  comingSoon?: boolean; // shown as a muted "soon" marker instead of ✓/✕ on every tier
}

const ALL_FEATURES: PlanFeature[] = [
  {
    label: "Bulk edit rules (Rules)",
    included: ["free", "starter", "pro", "advanced"],
  },
  {
    label: "Standard fields",
    included: ["free", "starter", "pro", "advanced"],
  },
  { label: "AI command bar", included: ["free", "starter", "pro", "advanced"] },
  {
    label: "Product browser",
    included: ["free", "starter", "pro", "advanced"],
  },
  {
    label: "History & revert",
    included: ["free", "starter", "pro", "advanced"],
  },
  {
    label: "Run attribution (who ran it)",
    included: ["free", "starter", "pro", "advanced"],
  },
  {
    label: "Analytics dashboard",
    included: ["free", "starter", "pro", "advanced"],
  },
  { label: "Metafields", included: ["starter", "pro", "advanced"] },
  { label: "Conditions", included: ["starter", "pro", "advanced"] },
  { label: "SKU / Barcode / Weight", included: ["pro", "advanced"] },
  { label: "Automation", included: ["pro", "advanced"] },
  { label: "CSV import / export", included: ["pro", "advanced"] },
  { label: "Scheduled runs", included: ["advanced"] },
  { label: "Priority support", included: ["advanced"] },
  { label: "Multi-store", included: [], comingSoon: true },
];

const PLANS: {
  key: PlanKey;
  name: string;
  price: number;
  credits: string;
  templates: string;
  ribbon?: string;
}[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    credits: "5 credits/mo",
    templates: "1 saved template",
  },
  {
    key: "starter",
    name: "Starter",
    price: 15,
    credits: "60 credits/mo",
    templates: "5 saved templates",
    ribbon: "Most popular",
  },
  {
    key: "pro",
    name: "Pro",
    price: 39,
    credits: "400 credits/mo",
    templates: "Unlimited templates",
  },
  {
    key: "advanced",
    name: "Advanced",
    price: 79,
    credits: "2,500 credits/mo",
    templates: "Unlimited templates",
  },
];

export default function Plans() {
  const { currentPlan, justUpgraded, isTestCharge, host } =
    useLoaderData<typeof loader>();
  const downgradeFetcher = useFetcher<{ success: boolean }>();

  const currentIndex = PLAN_ORDER.indexOf(currentPlan as PlanKey);

  const handleDowngrade = (planKey: PlanKey) => {
    if (
      !window.confirm(
        `Switch to the ${planKey === "free" ? "Free" : planKey} plan? This reduces your credits, saved templates, and unlocked features immediately.`,
      )
    )
      return;
    downgradeFetcher.submit(
      { plan: planKey, host },
      { method: "POST", action: "/app/billing/upgrade" },
    );
  };

  useEffect(() => {
    if (downgradeFetcher.data?.success) {
      window.location.reload();
    }
  }, [downgradeFetcher.data]);

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Plans</h1>
            <p>
              Pick the plan that matches how much of your catalog you're
              touching.
            </p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        {justUpgraded && (
          <div className="ps-billing-banner">
            You're now on the{" "}
            {justUpgraded.charAt(0).toUpperCase() + justUpgraded.slice(1)} plan
            — credits and unlocked features are live immediately.
          </div>
        )}

        <div className="ps-grid-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const planIndex = PLAN_ORDER.indexOf(plan.key);
            const isUpgrade = planIndex > currentIndex;
            const isDowngrade = planIndex < currentIndex;

            return (
              <div
                className="ps-card"
                key={plan.key}
                style={{
                  position: "relative",
                  border:
                    plan.ribbon && !isCurrent
                      ? "2px solid var(--ps-trace, #ff8a3d)"
                      : undefined,
                }}
              >
                {plan.ribbon && !isCurrent && (
                  <span className="ps-plan-ribbon">{plan.ribbon}</span>
                )}
                <div className="ps-card-label">
                  {plan.name}
                  {isCurrent && (
                    <span className="ps-pill ps-pill-success">Current</span>
                  )}
                </div>
                <div className="ps-card-body">
                  <div className="ps-plan-price-block">
                    <div className="ps-plan-price">${plan.price}</div>
                    <div className="ps-plan-price-period">per month</div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#7c8aa5",
                      fontFamily: "IBM Plex Mono, monospace",
                      textAlign: "center",
                      lineHeight: 1.6,
                    }}
                  >
                    <div>{plan.credits}</div>
                    <div>{plan.templates}</div>
                  </div>
                  <div className="ps-divider" />

                  <div>
                    {ALL_FEATURES.map((f) => {
                      if (f.comingSoon) {
                        return (
                          <div className="ps-plan-feature-row" key={f.label}>
                            <span
                              className="ps-plan-feature-x"
                              style={{ color: "var(--ps-muted)" }}
                            >
                              ◔
                            </span>
                            <span className="ps-plan-feature-label-off">
                              {f.label} (soon)
                            </span>
                          </div>
                        );
                      }
                      const included = f.included.includes(plan.key);
                      return (
                        <div className="ps-plan-feature-row" key={f.label}>
                          {included ? (
                            <span className="ps-plan-feature-check">✓</span>
                          ) : (
                            <span className="ps-plan-feature-x">✕</span>
                          )}
                          <span
                            className={
                              included ? "" : "ps-plan-feature-label-off"
                            }
                          >
                            {f.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="ps-divider" />

                  {isCurrent ? (
                    <button
                      className="ps-btn-outline"
                      disabled
                      style={{ width: "100%" }}
                    >
                      Current plan
                    </button>
                  ) : isUpgrade ? (
                    <Form method="POST" action="/app/billing/upgrade">
                      <input type="hidden" name="plan" value={plan.key} />
                      <input type="hidden" name="host" value={host} />
                      <button type="submit" className="ps-btn-upgrade">
                        Upgrade
                      </button>
                    </Form>
                  ) : isDowngrade ? (
                    <button
                      className="ps-btn-downgrade"
                      onClick={() => handleDowngrade(plan.key)}
                      disabled={downgradeFetcher.state === "submitting"}
                    >
                      {downgradeFetcher.state === "submitting"
                        ? "Switching…"
                        : "Downgrade"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {isTestCharge && (
          <div className="ps-test-charge-note">
            Test mode — charges on this store are simulated and no real money is
            charged.
          </div>
        )}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
