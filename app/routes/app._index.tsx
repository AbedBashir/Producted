import { useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import db from "../db.server";
import WhatsNewPanel from "../components/WhatsNewPanel";
import "../styles/shared.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const appSettings = await db.appSettings.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });

  if (!appSettings.onboardingCompleted) {
    const search = new URL(request.url).search;
    throw redirect(`/app/onboarding${search}`);
  }

  const [countResponse, credits, recentRuns] = await Promise.all([
    admin.graphql(
      `#graphql
        query GetProductCount {
          productsCount { count }
        }`,
    ),
    getCreditStatus(session.shop),
    db.editHistory.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const countData = await countResponse.json();

  const metafieldsResponse = await admin.graphql(
    `#graphql
      query GetProductMetafieldDefinitions {
        metafieldDefinitions(ownerType: PRODUCT, first: 100) {
          edges { node { namespace key } }
        }
      }`,
  );
  const metafieldsData = await metafieldsResponse.json();
  const metafieldDefs = metafieldsData.data.metafieldDefinitions.edges.map(
    (e: any) => e.node,
  );
  const metafieldKeys = metafieldDefs.map(
    (d: any) => `${d.namespace}.${d.key}`,
  );

  const statsResponse = await admin.graphql(
    `#graphql
      query GetProductFullStats($keys: [String!]) {
        products(first: 100) {
          edges {
            node {
              id
              title
              descriptionHtml
              status
              featuredImage { id }
              seo { title description }
              metafields(keys: $keys, first: 50) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }`,
    { variables: { keys: metafieldKeys } },
  );
  const statsData = await statsResponse.json();
  const products = statsData.data.products.edges.map((e: any) => e.node);

  const strip = (html: string | null) =>
    (html ?? "").replace(/<[^>]*>/g, "").trim();

  const missingTitleCount = products.filter(
    (p: any) => !p.title || !p.title.trim(),
  ).length;
  const missingDescriptionCount = products.filter(
    (p: any) => !strip(p.descriptionHtml),
  ).length;
  const missingSeoCount = products.filter(
    (p: any) => !p.seo?.title || !p.seo?.description,
  ).length;
  const missingImageCount = products.filter(
    (p: any) => !p.featuredImage,
  ).length;
  const notActiveCount = products.filter(
    (p: any) => p.status !== "ACTIVE",
  ).length;

  const missingMetafieldCount =
    metafieldKeys.length === 0
      ? 0
      : products.filter((p: any) => {
          const presentKeys = new Set(
            (p.metafields?.edges ?? []).map(
              (e: any) => `${e.node.namespace}.${e.node.key}`,
            ),
          );
          return metafieldKeys.some((k: string) => !presentKeys.has(k));
        }).length;

  const activity = recentRuns.map((r) => {
    const ruleChain = JSON.parse(r.ruleChain);
    return {
      id: r.id,
      text: `${ruleChain.action === "set" ? "Set" : ruleChain.action} ${ruleChain.field?.label ?? "field"} to "${ruleChain.value}"`,
      targetCount: r.targetCount,
      status: r.status,
      date: r.createdAt.toISOString(),
    };
  });

  return {
    totalProducts: countData.data.productsCount.count as number,
    creditsUsed: credits.used,
    creditsTotal: credits.total,
    hasMetafieldDefs: metafieldKeys.length > 0,
    checks: {
      missingTitleCount,
      missingDescriptionCount,
      missingSeoCount,
      missingImageCount,
      notActiveCount,
      missingMetafieldCount,
    },
    activity,
  };
};

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

interface ParseResult {
  success: boolean;
  fieldKey?: string;
  fieldLabel?: string;
  action?: string;
  value?: string;
  confidence?: string;
  targetType?: "all" | "products";
  targetIds?: string[];
  targetLabel?: string;
  error?: string;
}

interface ExecuteResult {
  success: boolean;
  updatedCount: number;
  errors: string[];
}

export default function Home() {
  const {
    totalProducts,
    creditsUsed,
    creditsTotal,
    checks,
    hasMetafieldDefs,
    activity,
  } = useLoaderData<typeof loader>();
  const creditPct = Math.min((creditsUsed / creditsTotal) * 100, 100);

  const [command, setCommand] = useState("");
  const parseFetcher = useFetcher<ParseResult>();
  const executeFetcher = useFetcher<ExecuteResult>();
  const sliderRef = useRef<HTMLDivElement>(null);

  const scrollSlider = (direction: "left" | "right") => {
    const el = sliderRef.current;
    if (!el) return;
    const cardWidth = 280 + 16;
    el.scrollBy({
      left: direction === "left" ? -cardWidth : cardWidth,
      behavior: "smooth",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    parseFetcher.submit(JSON.stringify({ command }), {
      method: "POST",
      action: "/api/parse-command",
      encType: "application/json",
    });
  };

  const result = parseFetcher.data;

  const rulesLink =
    result?.success && result.fieldKey
      ? `/app/rules?field=${encodeURIComponent(result.fieldKey)}&action=${encodeURIComponent(
          result.action ?? "set",
        )}&value=${encodeURIComponent(result.value ?? "")}`
      : "/app/rules";

  const handleApplyDirectly = () => {
    if (!result?.success) return;

    const confirmed = window.confirm(
      `Apply "${result.fieldLabel} → ${result.value}" to: ${result.targetLabel}?\n\nThis cannot be undone from here — it will run immediately.`,
    );
    if (!confirmed) return;

    const fieldPayload = {
      key: result.fieldKey,
      label: result.fieldLabel,
      group: result.fieldKey?.startsWith("mf:")
        ? "Metafields"
        : "Product fields",
      actions: [result.action],
      valueInputType: "text",
      metafield: result.fieldKey?.startsWith("mf:")
        ? {
            namespace: result.fieldKey.split(":")[1],
            key: result.fieldKey.split(":")[2],
            type: "single_line_text_field",
          }
        : undefined,
    };

    executeFetcher.submit(
      JSON.stringify({
        field: fieldPayload,
        action: result.action,
        value: result.value,
        conditions: [],
        targetType: result.targetType,
        targetIds: result.targetIds ?? [],
      }),
      {
        method: "POST",
        action: "/api/execute-rule",
        encType: "application/json",
      },
    );
  };

  type CheckCard = {
    key: string;
    badge: string;
    count: number;
    title: string;
    desc: string;
    okTitle: string;
    okDesc: string;
    link: string;
  };

  const checkCards: CheckCard[] = [
    {
      key: "title",
      badge: "TITLE",
      count: checks.missingTitleCount,
      title: `${checks.missingTitleCount} product${checks.missingTitleCount === 1 ? "" : "s"} missing a title`,
      desc: "Every product needs a title to display correctly in your store and search.",
      okTitle: "Titles",
      okDesc: "Every product has a title set.",
      link: "/app/rules?field=title&action=set",
    },
    {
      key: "description",
      badge: "DESCRIPTION",
      count: checks.missingDescriptionCount,
      title: `${checks.missingDescriptionCount} product${checks.missingDescriptionCount === 1 ? "" : "s"} missing a description`,
      desc: "Descriptions help customers decide and help search engines understand the product.",
      okTitle: "Descriptions",
      okDesc: "Every product has a description written.",
      link: "/app/rules",
    },
    {
      key: "seo",
      badge: "SEO",
      count: checks.missingSeoCount,
      title: `${checks.missingSeoCount} product${checks.missingSeoCount === 1 ? "" : "s"} missing SEO title or description`,
      desc: "Fill them in bulk instead of one by one — takes seconds with a single rule.",
      okTitle: "SEO",
      okDesc: "All products are well structured for search.",
      link: "/app/rules?field=seoDescription&action=set",
    },
    {
      key: "images",
      badge: "IMAGES",
      count: checks.missingImageCount,
      title: `${checks.missingImageCount} product${checks.missingImageCount === 1 ? "" : "s"} with no image`,
      desc: "Products without a photo convert far worse and look unfinished in your catalog.",
      okTitle: "Images",
      okDesc: "Every product has at least one image.",
      link: "/app/products",
    },
    {
      key: "status",
      badge: "STATUS",
      count: checks.notActiveCount,
      title: `${checks.notActiveCount} product${checks.notActiveCount === 1 ? "" : "s"} not Active (draft or archived)`,
      desc: "Review and publish them in bulk, or archive if they're not launching.",
      okTitle: "Status",
      okDesc: "Every product is Active and live.",
      link: "/app/rules?field=status&action=set&value=ACTIVE",
    },
    ...(hasMetafieldDefs
      ? [
          {
            key: "metafields",
            badge: "METAFIELDS",
            count: checks.missingMetafieldCount,
            title: `${checks.missingMetafieldCount} product${checks.missingMetafieldCount === 1 ? "" : "s"} missing a metafield value`,
            desc: "Some of your defined metafields aren't filled in on every product yet.",
            okTitle: "Metafields",
            okDesc: "Every defined metafield is filled in across your catalog.",
            link: "/app/rules",
          },
        ]
      : []),
  ];

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Welcome back</h1>
            <p>Here's what's worth fixing across your catalog today.</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <WhatsNewPanel />
            <span className="ps-eyebrow">FUSIONS · Producted</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ps-ai-bar">
            <span className="ps-ai-icon">▸</span>
            <input
              className="ps-ai-input"
              placeholder="Tell Producted what to change — e.g. 'raise prices 10% on all hoodies'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
            <button
              className="ps-btn-primary"
              type="submit"
              disabled={parseFetcher.state === "submitting"}
            >
              {parseFetcher.state === "submitting" ? "Thinking…" : "Parse"}
            </button>
          </div>
        </form>

        {result && result.success && (
          <div className="ps-ai-result">
            <span className="ps-ai-result-text">
              Field: {result.fieldLabel} · Action: {result.action} · Value:{" "}
              {result.value}
              <br />
              Target: {result.targetLabel}
              {result.confidence === "low" &&
                " · (low confidence — double check before applying)"}
            </span>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <Link to={rulesLink}>
                <button className="ps-btn-dark" style={{ width: 140 }}>
                  Open in Rules
                </button>
              </Link>
              <button
                className="ps-btn-primary"
                style={{ width: 140 }}
                onClick={handleApplyDirectly}
                disabled={executeFetcher.state === "submitting"}
              >
                {executeFetcher.state === "submitting"
                  ? "Applying…"
                  : "Apply directly"}
              </button>
            </div>
          </div>
        )}

        {result && !result.success && (
          <div
            className="ps-ai-result"
            style={{
              background: "rgba(255,107,107,0.08)",
              borderColor: "rgba(255,107,107,0.3)",
            }}
          >
            <span className="ps-ai-result-text" style={{ color: "#c0392b" }}>
              {result.error ?? "Couldn't parse that — try rephrasing."}
            </span>
          </div>
        )}

        {executeFetcher.data && (
          <div
            className="ps-ai-result"
            style={
              executeFetcher.data.success
                ? undefined
                : {
                    background: "rgba(255,107,107,0.08)",
                    borderColor: "rgba(255,107,107,0.3)",
                  }
            }
          >
            <span
              className="ps-ai-result-text"
              style={
                executeFetcher.data.success ? undefined : { color: "#c0392b" }
              }
            >
              {executeFetcher.data.success
                ? `Done — ${executeFetcher.data.updatedCount} product(s) updated.`
                : `${executeFetcher.data.updatedCount} updated, ${executeFetcher.data.errors.length} error(s): ${executeFetcher.data.errors[0]}`}
            </span>
          </div>
        )}

        <div className="ps-grid-4" style={{ marginBottom: 32 }}>
          <div className="ps-stat-card">
            <div className="ps-stat-value">{totalProducts}</div>
            <div className="ps-stat-label">Products in store</div>
          </div>
          <div className="ps-stat-card">
            <div className="ps-stat-value">
              {creditsUsed}/{creditsTotal}
            </div>
            <div className="ps-stat-label">Credits used this month</div>
            <div className="ps-progress-track" style={{ marginTop: 8 }}>
              <div
                className="ps-progress-fill"
                style={{ width: `${creditPct}%` }}
              />
            </div>
          </div>
          <div className="ps-stat-card">
            <div className="ps-stat-value">0</div>
            <div className="ps-stat-label">Active automations</div>
          </div>
          <div className="ps-stat-card">
            <div className="ps-stat-value">
              {activity.length > 0 ? formatRelativeDate(activity[0].date) : "—"}
            </div>
            <div className="ps-stat-label">Last rule run</div>
          </div>
        </div>

        <div className="ps-slider-header">
          <div className="ps-section-title" style={{ margin: 0 }}>
            Catalog health
          </div>
          <div className="ps-slider-arrows">
            <button
              className="ps-slider-arrow"
              onClick={() => scrollSlider("left")}
              aria-label="Scroll left"
            >
              ‹
            </button>
            <button
              className="ps-slider-arrow"
              onClick={() => scrollSlider("right")}
              aria-label="Scroll right"
            >
              ›
            </button>
          </div>
        </div>
        <div className="ps-slider" ref={sliderRef} style={{ marginBottom: 32 }}>
          {checkCards.map((c) =>
            c.count > 0 ? (
              <div className="ps-check-card" key={c.key}>
                <span className="ps-check-badge-alert">{c.badge}</span>
                <div className="ps-check-title">{c.title}</div>
                <div className="ps-check-desc">{c.desc}</div>
                <Link to={c.link}>
                  <button className="ps-check-fix-btn">Fix now</button>
                </Link>
              </div>
            ) : (
              <div className="ps-check-card" key={c.key}>
                <span className="ps-check-badge-ok">✓ {c.badge}</span>
                <div className="ps-check-title">{c.okTitle}</div>
                <div className="ps-check-desc">{c.okDesc}</div>
                <button className="ps-check-complete-btn" disabled>
                  ✓ Resolved
                </button>
              </div>
            ),
          )}
        </div>

        <div className="ps-section-title">Recent activity</div>
        <div className="ps-card">
          <div className="ps-card-body">
            {activity.length === 0 ? (
              <p className="ps-empty" style={{ padding: 8 }}>
                No rules run yet — your activity will show up here once you run
                your first edit.
              </p>
            ) : (
              activity.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--ps-border, #e2e5ea)",
                    fontSize: 13,
                  }}
                >
                  <span>
                    {a.text} — {a.targetCount} product
                    {a.targetCount === 1 ? "" : "s"}
                  </span>
                  <span
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <span
                      className={`ps-pill ${
                        a.status === "completed"
                          ? "ps-pill-success"
                          : a.status === "reverted"
                            ? "ps-pill-neutral"
                            : "ps-pill-danger"
                      }`}
                    >
                      {a.status}
                    </span>
                    <span style={{ color: "#7c8aa5" }}>
                      {formatRelativeDate(a.date)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
