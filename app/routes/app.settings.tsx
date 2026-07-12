import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { PLAN_LABELS } from "../lib/plans";
import "../styles/shared.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const credits = await getCreditStatus(session.shop);
  return { credits };
};

interface SettingsData {
  automationsPaused: boolean;
  weeklyDigestEnabled: boolean;
}

type ConfirmTarget = "history" | "automations" | "templates" | null;

export default function Settings() {
  const { credits } = useLoaderData<typeof loader>();
  const settingsFetcher = useFetcher<SettingsData>();
  const toggleFetcher = useFetcher<{ success: boolean }>();
  const clearFetcher = useFetcher<{ success: boolean; deletedCount: number }>();
  const clearDataFetcher = useFetcher<{
    success: boolean;
    deletedCount: number;
  }>();

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [lastResultLabel, setLastResultLabel] = useState<string | null>(null);

  useEffect(() => {
    settingsFetcher.load("/api/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settings = settingsFetcher.data;

  const toggleAutomationsPaused = () => {
    if (!settings) return;
    const nextValue = !settings.automationsPaused;
    toggleFetcher.submit(
      JSON.stringify({ intent: "toggle-automations-paused", value: nextValue }),
      { method: "POST", action: "/api/settings", encType: "application/json" },
    );
    settingsFetcher.data = { ...settings, automationsPaused: nextValue }; // optimistic
  };

  const toggleWeeklyDigest = () => {
    if (!settings) return;
    const nextValue = !settings.weeklyDigestEnabled;
    toggleFetcher.submit(
      JSON.stringify({ intent: "toggle-weekly-digest", value: nextValue }),
      { method: "POST", action: "/api/settings", encType: "application/json" },
    );
    settingsFetcher.data = { ...settings, weeklyDigestEnabled: nextValue }; // optimistic
  };

  useEffect(() => {
    if (toggleFetcher.data?.success) {
      settingsFetcher.load("/api/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleFetcher.data]);

  const handleClearHistory = () => {
    clearFetcher.submit(JSON.stringify({ intent: "clear-history" }), {
      method: "POST",
      action: "/api/settings",
      encType: "application/json",
    });
    setConfirmTarget(null);
    setLastResultLabel("history");
  };

  const handleClearAutomations = () => {
    clearDataFetcher.submit(JSON.stringify({ intent: "clear-automations" }), {
      method: "POST",
      action: "/api/clear-data",
      encType: "application/json",
    });
    setConfirmTarget(null);
    setLastResultLabel("automations");
  };

  const handleClearTemplates = () => {
    clearDataFetcher.submit(JSON.stringify({ intent: "clear-templates" }), {
      method: "POST",
      action: "/api/clear-data",
      encType: "application/json",
    });
    setConfirmTarget(null);
    setLastResultLabel("templates");
  };

  const confirmCopy: Record<
    Exclude<ConfirmTarget, null>,
    { text: string; onConfirm: () => void }
  > = {
    history: {
      text: "This permanently deletes every entry in History, including the ability to revert past runs. This can't be undone.",
      onConfirm: handleClearHistory,
    },
    automations: {
      text: "This permanently deletes every automation you've built, including their run history and settings. This can't be undone.",
      onConfirm: handleClearAutomations,
    },
    templates: {
      text: "This permanently deletes every saved template on the Rules page. This can't be undone.",
      onConfirm: handleClearTemplates,
    },
  };

  const anyClearing =
    clearFetcher.state === "submitting" ||
    clearDataFetcher.state === "submitting";

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Settings</h1>
            <p>Plan, notifications, and safety controls.</p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        {settings?.automationsPaused && (
          <div className="ps-global-pause-banner">
            ⏸ All automations are currently paused store-wide — none will run
            until you turn this off below.
          </div>
        )}

        <div className="ps-grid-2">
          <div className="ps-card">
            <div className="ps-card-label">Plan & credits</div>
            <div className="ps-card-body">
              <div style={{ fontSize: 14 }}>
                {PLAN_LABELS[credits.plan]} —{" "}
                <span style={{ color: "#7c8aa5" }}>
                  {credits.used}/{credits.total} credits used this month
                </span>
              </div>
              <div className="ps-progress-track">
                <div
                  className="ps-progress-fill"
                  style={{
                    width: `${Math.min((credits.used / credits.total) * 100, 100)}%`,
                  }}
                />
              </div>
              <a href="/app/plans">
                <button
                  className="ps-btn-dark"
                  style={{ width: "fit-content" }}
                >
                  Manage plan
                </button>
              </a>
            </div>
          </div>

          <div className="ps-card">
            <div className="ps-card-label">Notifications</div>
            <div className="ps-card-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Weekly opportunity digest
                  </div>
                  <div style={{ fontSize: 12, color: "#7c8aa5" }}>
                    Email summary of products worth bulk-editing
                  </div>
                  <div className="ps-settings-note">
                    Preference saves now — email delivery is coming in a future
                    update.
                  </div>
                </div>
                <button
                  className={`ps-toggle ${settings?.weeklyDigestEnabled ? "on" : ""}`}
                  onClick={toggleWeeklyDigest}
                  disabled={!settings}
                />
              </div>
            </div>
          </div>

          <div className="ps-card">
            <div className="ps-card-label">Automation defaults</div>
            <div className="ps-card-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Pause all automations
                  </div>
                  <div style={{ fontSize: 12, color: "#7c8aa5" }}>
                    Global safety switch — stops every automation without
                    deleting them
                  </div>
                </div>
                <button
                  className={`ps-toggle ${settings?.automationsPaused ? "on" : ""}`}
                  onClick={toggleAutomationsPaused}
                  disabled={!settings}
                />
              </div>
            </div>
          </div>

          <div
            className="ps-card"
            style={{ border: "1px solid rgba(255,107,107,0.4)" }}
          >
            <div className="ps-card-label" style={{ background: "#3a1414" }}>
              Danger zone
            </div>
            <div className="ps-card-body">
              {confirmTarget ? (
                <div>
                  <p className="ps-danger-confirm-text">
                    {confirmCopy[confirmTarget].text}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="ps-btn-outline"
                      onClick={() => setConfirmTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="ps-btn-danger-outline"
                      onClick={confirmCopy[confirmTarget].onConfirm}
                      disabled={anyClearing}
                    >
                      {anyClearing ? "Clearing…" : "Yes, delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ps-danger-row">
                  <button
                    className="ps-btn-danger-outline"
                    onClick={() => setConfirmTarget("history")}
                  >
                    Clear edit history
                  </button>
                  <button
                    className="ps-btn-danger-outline"
                    onClick={() => setConfirmTarget("automations")}
                  >
                    Clear all automations
                  </button>
                  <button
                    className="ps-btn-danger-outline"
                    onClick={() => setConfirmTarget("templates")}
                  >
                    Clear all templates
                  </button>
                </div>
              )}

              {lastResultLabel === "history" && clearFetcher.data?.success && (
                <p style={{ fontSize: 13, color: "#0d7d6f", marginTop: 10 }}>
                  Cleared {clearFetcher.data.deletedCount} history entries.
                </p>
              )}
              {lastResultLabel !== "history" &&
                clearDataFetcher.data?.success && (
                  <p style={{ fontSize: 13, color: "#0d7d6f", marginTop: 10 }}>
                    Cleared {clearDataFetcher.data.deletedCount}{" "}
                    {lastResultLabel}.
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
