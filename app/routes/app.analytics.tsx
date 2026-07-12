import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import "../styles/shared.css";

const SECONDS_SAVED_PER_PRODUCT = 45; // rough estimate: manual edit time saved per product

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixWeeksAgo = new Date(now);
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

  const runs = await db.editHistory.findMany({
    where: {
      shop: session.shop,
      status: "completed",
      createdAt: { gte: sixWeeksAgo },
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });

  const thisMonthRuns = runs.filter((r) => r.createdAt >= startOfMonth);
  const productsOptimizedThisMonth = thisMonthRuns.reduce(
    (sum, r) => sum + r.targetCount,
    0,
  );
  const avgProductsPerRun =
    runs.length > 0
      ? Math.round(
          runs.reduce((sum, r) => sum + r.targetCount, 0) / runs.length,
        )
      : 0;
  const totalProductsAllTime = runs.reduce((sum, r) => sum + r.targetCount, 0);
  const estimatedHoursSaved = Math.round(
    (totalProductsAllTime * SECONDS_SAVED_PER_PRODUCT) / 3600,
  );

  // Bucket into the last 6 calendar weeks, split manual vs automation.
  const weekBuckets: { label: string; manual: number; automation: number }[] =
    [];
  for (let i = 5; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7 - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let manual = 0;
    let automation = 0;
    for (const r of runs) {
      if (r.createdAt >= weekStart && r.createdAt < weekEnd) {
        let isAutomation = false;
        try {
          isAutomation = Array.isArray(JSON.parse(r.ruleChain).rules);
        } catch {
          // ignore malformed rows
        }
        if (isAutomation) automation += r.targetCount;
        else manual += r.targetCount;
      }
    }
    weekBuckets.push({ label: `Wk ${6 - i}`, manual, automation });
  }

  // Most-edited fields, across both manual and automation runs.
  const fieldCounts: Record<string, number> = {};
  for (const r of runs) {
    try {
      const chain = JSON.parse(r.ruleChain);
      if (Array.isArray(chain.rules)) {
        for (const step of chain.rules) {
          const label = step.field?.label ?? "Unknown";
          fieldCounts[label] = (fieldCounts[label] ?? 0) + 1;
        }
      } else if (chain.field?.label) {
        fieldCounts[chain.field.label] =
          (fieldCounts[chain.field.label] ?? 0) + 1;
      }
    } catch {
      // ignore malformed rows
    }
  }
  const topFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const manualRunCount = runs.filter((r) => {
    try {
      return !Array.isArray(JSON.parse(r.ruleChain).rules);
    } catch {
      return true;
    }
  }).length;
  const automationRunCount = runs.length - manualRunCount;

  return {
    productsOptimizedThisMonth,
    avgProductsPerRun,
    estimatedHoursSaved,
    weekBuckets,
    topFields,
    manualRunCount,
    automationRunCount,
  };
};

export default function Analytics() {
  const {
    productsOptimizedThisMonth,
    avgProductsPerRun,
    estimatedHoursSaved,
    weekBuckets,
    topFields,
    manualRunCount,
    automationRunCount,
  } = useLoaderData<typeof loader>();

  const maxWeekTotal = Math.max(
    ...weekBuckets.map((w) => w.manual + w.automation),
    1,
  );
  const maxFieldCount = Math.max(...topFields.map((f) => f.count), 1);
  const totalRuns = manualRunCount + automationRunCount;

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Analytics</h1>
            <p>How much manual work Producted has saved you.</p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        <div className="ps-grid-3" style={{ marginBottom: 32 }}>
          <div className="ps-stat-card">
            <div className="ps-stat-value">{productsOptimizedThisMonth}</div>
            <div className="ps-stat-label">Products optimized this month</div>
          </div>
          <div className="ps-stat-card">
            <div className="ps-stat-value">~{estimatedHoursSaved} hrs</div>
            <div className="ps-stat-label">
              Estimated manual time saved (all time)
            </div>
          </div>
          <div className="ps-stat-card">
            <div className="ps-stat-value">{avgProductsPerRun}</div>
            <div className="ps-stat-label">Avg. products per rule run</div>
          </div>
        </div>

        <div className="ps-section-title">Edits per week</div>
        <div className="ps-card" style={{ marginBottom: 32 }}>
          <div className="ps-card-body">
            {totalRuns === 0 ? (
              <p className="ps-empty" style={{ padding: 8 }}>
                No completed runs in the last 6 weeks yet.
              </p>
            ) : (
              <>
                <div className="ps-chart-wrap">
                  {weekBuckets.map((w) => {
                    const total = w.manual + w.automation;
                    const heightPx =
                      maxWeekTotal > 0
                        ? Math.max(
                            (total / maxWeekTotal) * 140,
                            total > 0 ? 6 : 0,
                          )
                        : 0;
                    const manualPct = total > 0 ? (w.manual / total) * 100 : 0;
                    const autoPct =
                      total > 0 ? (w.automation / total) * 100 : 0;
                    return (
                      <div className="ps-chart-col" key={w.label}>
                        <div
                          style={{
                            height: 140,
                            display: "flex",
                            alignItems: "flex-end",
                            width: "100%",
                          }}
                        >
                          <div
                            className="ps-chart-bar-stack"
                            style={{ height: `${heightPx}px` }}
                            title={`${total} edits (${w.manual} manual, ${w.automation} automation)`}
                          >
                            {autoPct > 0 && (
                              <div
                                className="ps-chart-bar-automation"
                                style={{ height: `${autoPct}%` }}
                              />
                            )}
                            {manualPct > 0 && (
                              <div
                                className="ps-chart-bar-manual"
                                style={{ height: `${manualPct}%` }}
                              />
                            )}
                          </div>
                        </div>
                        <span className="ps-chart-label">{w.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="ps-chart-legend">
                  <div className="ps-chart-legend-item">
                    <span
                      className="ps-chart-legend-swatch"
                      style={{ background: "var(--ps-trace)" }}
                    />
                    Manual (Rules)
                  </div>
                  <div className="ps-chart-legend-item">
                    <span
                      className="ps-chart-legend-swatch"
                      style={{ background: "var(--ps-signal)" }}
                    />
                    Automation
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ps-grid-2">
          <div>
            <div className="ps-section-title">Most-edited fields</div>
            <div className="ps-card">
              <div className="ps-card-body">
                {topFields.length === 0 ? (
                  <p className="ps-empty" style={{ padding: 8 }}>
                    No data yet.
                  </p>
                ) : (
                  topFields.map((f) => (
                    <div className="ps-field-bar-row" key={f.label}>
                      <span className="ps-field-bar-label">{f.label}</span>
                      <div className="ps-field-bar-track">
                        <div
                          className="ps-field-bar-fill"
                          style={{
                            width: `${(f.count / maxFieldCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="ps-field-bar-count">{f.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="ps-section-title">Manual vs. automated</div>
            <div className="ps-card">
              <div className="ps-card-body">
                {totalRuns === 0 ? (
                  <p className="ps-empty" style={{ padding: 8 }}>
                    No runs yet.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      <span>Manual (Rules)</span>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {manualRunCount} runs
                      </span>
                    </div>
                    <div
                      className="ps-progress-track"
                      style={{ marginBottom: 16 }}
                    >
                      <div
                        className="ps-progress-fill"
                        style={{
                          width: `${(manualRunCount / totalRuns) * 100}%`,
                          background: "var(--ps-trace)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      <span>Automation</span>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {automationRunCount} runs
                      </span>
                    </div>
                    <div className="ps-progress-track">
                      <div
                        className="ps-progress-fill"
                        style={{
                          width: `${(automationRunCount / totalRuns) * 100}%`,
                          background: "var(--ps-signal)",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
