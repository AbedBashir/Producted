import { useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum, CSV_MIN_PLAN, type PlanKey } from "../lib/plans";
import { parseCsv, rowsToObjects } from "../lib/csv-utils";
import type { ImportRowDiff } from "../lib/csv-import.server";
import "../styles/shared.css";
import "../styles/rule-builder.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const credits = await getCreditStatus(session.shop);
  return { plan: credits.plan as PlanKey };
};

interface PreviewResult {
  success: boolean;
  error?: string;
  diffs?: ImportRowDiff[];
  skippedColumns?: string[];
}

interface ExecuteResult {
  success: boolean;
  updatedCount: number;
  errors: string[];
}

export default function ImportExport() {
  const { plan } = useLoaderData<typeof loader>();
  const locked = !planMeetsMinimum(plan, CSV_MIN_PLAN);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/export-products");
      if (!response.ok) {
        const text = await response.text();
        window.alert(text || "Export failed.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `producted-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert("Export failed — check the console for details.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(
    null,
  );

  const previewFetcher = useFetcher<PreviewResult>();
  const executeFetcher = useFetcher<ExecuteResult>();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = rowsToObjects(parseCsv(text));
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const runPreview = () => {
    if (!parsedRows) return;
    previewFetcher.submit(JSON.stringify({ rows: parsedRows }), {
      method: "POST",
      action: "/api/import-preview",
      encType: "application/json",
    });
  };

  const runExecute = () => {
    if (!parsedRows) return;
    if (
      !window.confirm(
        "Apply these changes? This runs immediately and can't be undone from here.",
      )
    )
      return;
    executeFetcher.submit(JSON.stringify({ rows: parsedRows }), {
      method: "POST",
      action: "/api/import-execute",
      encType: "application/json",
    });
  };

  const preview = previewFetcher.data;
  const changedRows =
    preview?.diffs?.filter((d) => d.changes.length > 0 || d.error) ?? [];

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Import / Export</h1>
            <p>
              Bulk edit your catalog with a spreadsheet, or pull one for
              reference.
            </p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        {locked ? (
          <div className="rb-locked-banner" style={{ marginBottom: 32 }}>
            <span className="rb-crown-badge">👑 Pro</span>
            <span className="rb-locked-text">
              CSV import and export require the Pro plan or higher.
            </span>
            <Link to="/app/plans" className="rb-upgrade-link">
              Upgrade →
            </Link>
          </div>
        ) : (
          <>
            <div className="ps-section-title">Export</div>
            <div className="ps-card" style={{ marginBottom: 32 }}>
              <div className="ps-card-body">
                <p style={{ fontSize: 13, color: "#7c8aa5" }}>
                  Downloads every product (up to 1,000) with all standard fields
                  and metafields as a CSV.
                </p>
                <button
                  className="ps-btn-primary"
                  style={{ width: "fit-content" }}
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? "Exporting…" : "Export all products (CSV)"}
                </button>
              </div>
            </div>

            <div className="ps-section-title">Import</div>
            <div className="ps-card" style={{ marginBottom: 20 }}>
              <div className="ps-card-body">
                <p style={{ fontSize: 13, color: "#7c8aa5" }}>
                  Upload a CSV with an <code>id</code> column plus any of:
                  title, vendor, productType, tags, status, seoTitle,
                  seoDescription, price, compareAtPrice, sku, barcode, weight.
                  Metafield and inventory columns are read-only for now — edit
                  those from Rules instead.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ marginBottom: 12 }}
                />
                {fileName && (
                  <div style={{ fontSize: 13, marginBottom: 12 }}>
                    Loaded <strong>{fileName}</strong> —{" "}
                    {parsedRows?.length ?? 0} row(s).
                  </div>
                )}
                <button
                  className="ps-btn-outline"
                  onClick={runPreview}
                  disabled={
                    !parsedRows || previewFetcher.state === "submitting"
                  }
                >
                  {previewFetcher.state === "submitting"
                    ? "Checking…"
                    : "Preview changes"}
                </button>
              </div>
            </div>

            {preview && !preview.success && (
              <div className="ps-card" style={{ marginBottom: 20 }}>
                <div className="ps-card-body">
                  <p className="ps-csv-error">{preview.error}</p>
                </div>
              </div>
            )}

            {preview?.success && (
              <div className="ps-card" style={{ marginBottom: 20 }}>
                <div className="ps-card-body">
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    {changedRows.length} of {preview.diffs?.length ?? 0} row(s)
                    have changes.
                  </div>

                  {preview.skippedColumns &&
                    preview.skippedColumns.length > 0 && (
                      <p className="ps-csv-skip-note">
                        Skipped columns (not writable via import yet):{" "}
                        {preview.skippedColumns.join(", ")}
                      </p>
                    )}

                  <div
                    style={{ maxHeight: 400, overflowY: "auto", marginTop: 12 }}
                  >
                    {changedRows.map((row) => (
                      <div className="ps-csv-diff-row" key={row.id}>
                        <div className="ps-csv-diff-title">{row.title}</div>
                        {row.error ? (
                          <div className="ps-csv-error">{row.error}</div>
                        ) : (
                          row.changes.map((c, i) => (
                            <div className="ps-csv-diff-change" key={i}>
                              <span className="ps-csv-diff-field">
                                {c.fieldLabel}
                              </span>
                              <span className="ps-csv-diff-before">
                                {c.current || "—"}
                              </span>
                              <span className="ps-csv-diff-after">
                                → {c.next}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>

                  {changedRows.some((r) => !r.error) && (
                    <button
                      className="ps-btn-primary"
                      style={{ marginTop: 16 }}
                      onClick={runExecute}
                      disabled={executeFetcher.state === "submitting"}
                    >
                      {executeFetcher.state === "submitting"
                        ? "Applying…"
                        : "Apply import"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {executeFetcher.data && (
              <div className="ps-card">
                <div className="ps-card-body">
                  <p
                    style={{
                      fontSize: 13,
                      color: executeFetcher.data.success
                        ? "#0d7d6f"
                        : "var(--ps-danger)",
                    }}
                  >
                    {executeFetcher.data.success
                      ? `Done — ${executeFetcher.data.updatedCount} field update(s) applied.`
                      : `${executeFetcher.data.updatedCount} applied, ${executeFetcher.data.errors.length} error(s): ${executeFetcher.data.errors[0]}`}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
