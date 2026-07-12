import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import "../styles/shared.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const runs = await db.editHistory.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    runs: runs.map((r) => {
      const ruleChain = JSON.parse(r.ruleChain);
      const before = JSON.parse(r.beforeState) as {
        id: string;
        title: string;
        value: string;
      }[];
      const after = JSON.parse(r.afterState) as {
        id: string;
        title: string;
        value: string;
      }[];

      const diff = before.map((b, i) => ({
        product: b.title,
        before: b.value || "—",
        after: after[i]?.value || "—",
      }));

      const isAutomationRun = Array.isArray(ruleChain.rules);
      const isCsvImport = ruleChain.importedCsv === true;

      let ruleLabel: string;
      let fieldLabel: string;

      if (isAutomationRun) {
        const stepSummaries = ruleChain.rules.map(
          (step: any) =>
            `${step.action === "set" ? "Set" : step.action} ${step.field?.label ?? "field"} to "${step.value}"`,
        );
        ruleLabel = `[Automation: ${ruleChain.automationName ?? "Unnamed"}] ${stepSummaries.join(" · ")}`;
        fieldLabel = ruleChain.rules
          .map((step: any) => step.field?.label ?? "?")
          .join(", ");
      } else if (isCsvImport) {
        ruleLabel = `[CSV Import] ${ruleChain.rowCount} row(s) processed`;
        fieldLabel = "Multiple";
      } else {
        ruleLabel = `${ruleChain.action === "set" ? "Set" : ruleChain.action} ${ruleChain.field?.label ?? ""} to "${ruleChain.value}"`;
        fieldLabel = ruleChain.field?.label ?? "—";
      }

      return {
        id: r.id,
        rule: ruleLabel,
        field: fieldLabel,
        targetCount: r.targetCount,
        status: r.status,
        date: r.createdAt.toISOString(),
        diff,
        revertible:
          !isAutomationRun && !isCsvImport && r.status === "completed",
        runByName: r.runByName ?? "Unknown user",
      };
    }),
  };
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

export default function History() {
  const { runs } = useLoaderData<typeof loader>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const revertFetcher = useFetcher<{
    success: boolean;
    revertedCount: number;
    errors: string[];
  }>();

  const handleRevert = (runId: string) => {
    revertFetcher.submit(JSON.stringify({ runId }), {
      method: "POST",
      action: "/api/revert-run",
      encType: "application/json",
    });
  };

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>History</h1>
            <p>
              Every bulk edit, what changed, and a way back if something's
              wrong.
            </p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        <div className="ps-card">
          {runs.length === 0 ? (
            <div className="ps-empty" style={{ padding: 32 }}>
              No rules run yet — this fills up once you execute a rule on the
              Rules page.
            </div>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Rule</th>
                  <th>Field</th>
                  <th>Targets</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Run by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <>
                    <tr key={run.id}>
                      <td>
                        <button
                          className="ps-btn-outline"
                          style={{ padding: "4px 8px" }}
                          onClick={() =>
                            setExpanded(expanded === run.id ? null : run.id)
                          }
                        >
                          {expanded === run.id ? "−" : "+"}
                        </button>
                      </td>
                      <td>{run.rule}</td>
                      <td>{run.field}</td>
                      <td>{run.targetCount}</td>
                      <td>
                        <span
                          className={`ps-pill ${
                            run.status === "completed"
                              ? "ps-pill-success"
                              : run.status === "reverted"
                                ? "ps-pill-neutral"
                                : "ps-pill-danger"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td>{formatDate(run.date)}</td>
                      <td style={{ fontSize: 12, color: "#7c8aa5" }}>
                        {run.runByName}
                      </td>
                      <td>
                        {run.revertible && (
                          <button
                            className="ps-btn-danger-outline"
                            onClick={() => handleRevert(run.id)}
                            disabled={revertFetcher.state === "submitting"}
                          >
                            {revertFetcher.state === "submitting"
                              ? "Reverting…"
                              : "Revert"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === run.id && (
                      <tr key={`${run.id}-diff`}>
                        <td
                          colSpan={8}
                          style={{ background: "#fbfbfc", padding: 0 }}
                        >
                          <div style={{ padding: "16px 20px" }}>
                            {run.diff.length === 0 && (
                              <span style={{ fontSize: 13, color: "#7c8aa5" }}>
                                No changes recorded.
                              </span>
                            )}
                            {run.diff.map((d, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  gap: 16,
                                  fontSize: 13,
                                  padding: "6px 0",
                                  fontFamily: "IBM Plex Mono, monospace",
                                }}
                              >
                                <span style={{ flex: 1, color: "#12182b" }}>
                                  {d.product}
                                </span>
                                <span
                                  style={{
                                    color: "#7c8aa5",
                                    textDecoration: "line-through",
                                  }}
                                >
                                  {d.before}
                                </span>
                                <span style={{ color: "#0d7d6f" }}>
                                  → {d.after}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {revertFetcher.data && (
          <div className="ps-card" style={{ marginTop: 16, padding: 16 }}>
            <span style={{ fontSize: 13 }}>
              {revertFetcher.data.success
                ? `Reverted ${revertFetcher.data.revertedCount} product(s). Refresh to see updated status.`
                : `Revert had errors: ${revertFetcher.data.errors[0]}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
