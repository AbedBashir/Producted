import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum, PLAN_LABELS, type PlanKey } from "../lib/plans";
import {
  STATIC_FIELDS,
  ACTION_LABELS,
  metafieldToFieldOption,
  getActionsForField,
  getValueInputType,
  type FieldOption,
  type ActionKey,
  type RuleCondition,
  type ConditionField,
  type ConditionOperator,
} from "../lib/rule-config";
import "../styles/shared.css";
import "../styles/rule-builder.css";
import type { loader as automationsLoader } from "./api.automations";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const metafieldsResponse = await admin.graphql(
    `#graphql
      query GetProductMetafieldDefinitions {
        metafieldDefinitions(ownerType: PRODUCT, first: 100) {
          edges { node { namespace key name type { name } } }
        }
      }`,
  );
  const metafieldsData = await metafieldsResponse.json();
  const metafieldDefs = metafieldsData.data.metafieldDefinitions.edges.map(
    (e: any) => e.node,
  );

  const credits = await getCreditStatus(session.shop);

  return { metafieldDefs, plan: credits.plan as PlanKey };
};

const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  vendor: "Vendor",
  productType: "Product type",
  tags: "Tags",
  status: "Status",
  inventoryQty: "Inventory quantity",
};

const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "is",
  notEquals: "is not",
  contains: "contains",
  greaterThan: "is greater than",
  lessThan: "is less than",
};

interface RuleStepDraft {
  field: FieldOption;
  action: ActionKey;
  value: string;
}

interface PreviewAutomationResult {
  success: boolean;
  error?: string;
  productTitle?: string;
  conditionsPass?: boolean;
  steps?: {
    fieldLabel: string;
    currentValue: string;
    newValue: string;
    changed: boolean;
  }[];
}

const MAX_RULE_STEPS = 2;

export default function Automation() {
  const shopify = useAppBridge();
  const { metafieldDefs, plan } = useLoaderData<typeof loader>();
  const automationsFetcher = useFetcher<typeof automationsLoader>();
  const createFetcher = useFetcher<{ success: boolean; error?: string }>();
  const updateFetcher = useFetcher<{ success: boolean; error?: string }>();
  const toggleFetcher = useFetcher<{ success: boolean; error?: string }>();
  const deleteFetcher = useFetcher<{ success: boolean; error?: string }>();
  const testFetcher = useFetcher<PreviewAutomationResult>();
  const settingsFetcher = useFetcher<{
    automationsPaused: boolean;
    weeklyDigestEnabled: boolean;
  }>();

  const locked = !planMeetsMinimum(plan, "pro");

  const allFields: FieldOption[] = [
    ...STATIC_FIELDS,
    ...metafieldDefs.map(metafieldToFieldOption),
  ];
  const groupedFields = allFields.reduce<Record<string, FieldOption[]>>(
    (acc, f) => {
      (acc[f.group] ||= []).push(f);
      return acc;
    },
    {},
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<"created" | "updated">(
    "created",
  );
  const [ruleSteps, setRuleSteps] = useState<RuleStepDraft[]>([
    {
      field: allFields[0],
      action: getActionsForField(allFields[0])[0],
      value: "",
    },
  ]);
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [testProduct, setTestProduct] = useState<{
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    automationsFetcher.load("/api/automations");
    settingsFetcher.load("/api/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStep = (index: number, patch: Partial<RuleStepDraft>) => {
    setRuleSteps(
      ruleSteps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  };

  const handleStepFieldChange = (index: number, key: string) => {
    const next = allFields.find((f) => f.key === key)!;
    updateStep(index, {
      field: next,
      action: getActionsForField(next)[0],
      value: "",
    });
  };

  const addStep = () => {
    if (ruleSteps.length >= MAX_RULE_STEPS) return;
    setRuleSteps([
      ...ruleSteps,
      {
        field: allFields[0],
        action: getActionsForField(allFields[0])[0],
        value: "",
      },
    ]);
  };

  const removeStep = (index: number) => {
    setRuleSteps(ruleSteps.filter((_, i) => i !== index));
  };

  const addCondition = () =>
    setConditions([
      ...conditions,
      { field: "vendor", operator: "equals", value: "" },
    ]);
  const updateCondition = (i: number, patch: Partial<RuleCondition>) =>
    setConditions(
      conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );
  const removeCondition = (i: number) =>
    setConditions(conditions.filter((_, idx) => idx !== i));

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setTriggerEvent("created");
    setRuleSteps([
      {
        field: allFields[0],
        action: getActionsForField(allFields[0])[0],
        value: "",
      },
    ]);
    setConditions([]);
    setTestProduct(null);
  };

  const canSave = ruleSteps.every((s) => s.action === "toggle" || !!s.value);

  const handleSave = () => {
    const payload = {
      intent: editingId ? "update" : "create",
      id: editingId ?? undefined,
      name,
      triggerEvent,
      rules: ruleSteps,
      conditions,
    };
    const fetcher = editingId ? updateFetcher : createFetcher;
    fetcher.submit(JSON.stringify(payload), {
      method: "POST",
      action: "/api/automations",
      encType: "application/json",
    });
  };

  useEffect(() => {
    if (createFetcher.data?.success || updateFetcher.data?.success) {
      resetForm();
      automationsFetcher.load("/api/automations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createFetcher.data, updateFetcher.data]);

  const handleToggle = (id: string) => {
    toggleFetcher.submit(JSON.stringify({ intent: "toggle", id }), {
      method: "POST",
      action: "/api/automations",
      encType: "application/json",
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this automation? This can't be undone."))
      return;
    deleteFetcher.submit(JSON.stringify({ intent: "delete", id }), {
      method: "POST",
      action: "/api/automations",
      encType: "application/json",
    });
  };

  useEffect(() => {
    if (toggleFetcher.data?.success || deleteFetcher.data?.success) {
      automationsFetcher.load("/api/automations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleFetcher.data, deleteFetcher.data]);

  const handleEdit = (a: any) => {
    setEditingId(a.id);
    setName(a.name);
    setTriggerEvent(a.triggerEvent);
    setRuleSteps(
      a.rules.map((r: any) => {
        const match = allFields.find((f) => f.key === r.field.key) ?? r.field;
        return { field: match, action: r.action, value: r.value };
      }),
    );
    setConditions(a.conditions ?? []);
    setTestProduct(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickTestProduct = async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: false,
    });
    if (selection && selection[0]) {
      setTestProduct({ id: selection[0].id, title: selection[0].title });
    }
  };

  const runTest = () => {
    if (!testProduct) return;
    testFetcher.submit(
      JSON.stringify({
        productId: testProduct.id,
        rules: ruleSteps,
        conditions,
      }),
      {
        method: "POST",
        action: "/api/preview-automation",
        encType: "application/json",
      },
    );
  };

  const automations = automationsFetcher.data?.automations ?? [];
  const saveError = createFetcher.data?.error ?? updateFetcher.data?.error;
  const saving =
    createFetcher.state === "submitting" ||
    updateFetcher.state === "submitting";
  const globallyPaused = settingsFetcher.data?.automationsPaused ?? false;

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Automation</h1>
            <p>
              Rules that fire on their own when something changes in your store.
            </p>
          </div>
          <span className="ps-eyebrow">
            FUSIONS · Producted · {PLAN_LABELS[plan]}
          </span>
        </div>

        {globallyPaused && (
          <div className="ps-global-pause-banner">
            ⏸ All automations are paused store-wide from Settings — none will
            run until that's turned back on.
          </div>
        )}

        {locked ? (
          <div className="rb-locked-banner" style={{ marginBottom: 32 }}>
            <span className="rb-crown-badge">👑 Pro</span>
            <span className="rb-locked-text">
              Automation lets rules run themselves when products are created or
              updated. Requires the Pro plan or higher.
            </span>
            <Link to="/app/plans" className="rb-upgrade-link">
              Upgrade →
            </Link>
          </div>
        ) : (
          <>
            <div className="ps-section-title">
              {editingId ? "Edit automation" : "Build an automation"}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 64px 1.4fr 64px 1fr",
                alignItems: "stretch",
                marginBottom: 20,
              }}
            >
              <div className="ps-card">
                <div className="ps-card-label">Trigger</div>
                <div className="ps-card-body">
                  <div className="ps-field">
                    <label>When...</label>
                    <select
                      className="ps-select"
                      value={triggerEvent}
                      onChange={(e) =>
                        setTriggerEvent(e.target.value as "created" | "updated")
                      }
                    >
                      <option value="created">A product is created</option>
                      <option value="updated">A product is updated</option>
                    </select>
                  </div>
                  <div className="ps-field">
                    <label>Name (optional)</label>
                    <input
                      className="ps-input"
                      placeholder="e.g. Auto-tag new sale items"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="ps-connector-h">
                <svg width="64" height="2" viewBox="0 0 64 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="64"
                    y2="1"
                    className="ps-trace-line"
                  />
                  <line
                    x1="0"
                    y1="1"
                    x2="64"
                    y2="1"
                    className="ps-trace-line-animated"
                  />
                </svg>
              </div>

              <div className="ps-card">
                <div className="ps-card-label">Rules (run in order)</div>
                <div className="ps-card-body">
                  {ruleSteps.map((step, i) => {
                    const availableActions = getActionsForField(step.field);
                    return (
                      <div className="rb-rule-step" key={i}>
                        <div className="rb-rule-step-label">Step {i + 1}</div>
                        {ruleSteps.length > 1 && (
                          <button
                            className="rb-rule-step-delete"
                            onClick={() => removeStep(i)}
                            title="Remove step"
                          >
                            🗑
                          </button>
                        )}
                        <div className="ps-field" style={{ marginBottom: 8 }}>
                          <label>Field</label>
                          <select
                            className="ps-select"
                            value={step.field.key}
                            onChange={(e) =>
                              handleStepFieldChange(i, e.target.value)
                            }
                          >
                            {Object.entries(groupedFields).map(
                              ([group, fields]) => (
                                <optgroup label={group} key={group}>
                                  {fields.map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ),
                            )}
                          </select>
                        </div>
                        <div className="ps-field" style={{ marginBottom: 8 }}>
                          <label>Action</label>
                          <select
                            className="ps-select"
                            value={step.action}
                            onChange={(e) =>
                              updateStep(i, {
                                action: e.target.value as ActionKey,
                              })
                            }
                          >
                            {availableActions.map((a) => (
                              <option key={a} value={a}>
                                {ACTION_LABELS[a]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {step.action !== "toggle" && (
                          <div className="ps-field">
                            <label>Value</label>
                            <input
                              className="ps-input"
                              value={step.value}
                              onChange={(e) =>
                                updateStep(i, { value: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {ruleSteps.length < MAX_RULE_STEPS && (
                    <button
                      className="ps-btn-outline"
                      onClick={addStep}
                      style={{ width: "100%" }}
                    >
                      + Add rule
                    </button>
                  )}
                </div>
              </div>

              <div className="ps-connector-h">
                <svg width="64" height="2" viewBox="0 0 64 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="64"
                    y2="1"
                    className="ps-trace-line"
                  />
                  <line
                    x1="0"
                    y1="1"
                    x2="64"
                    y2="1"
                    className="ps-trace-line-animated"
                  />
                </svg>
              </div>

              <div className="ps-card">
                <div className="ps-card-label">Refine (optional)</div>
                <div className="ps-card-body">
                  {conditions.length === 0 && (
                    <p className="ps-empty" style={{ padding: 8 }}>
                      Applies to every product on this trigger.
                    </p>
                  )}
                  {conditions.map((cond, i) => (
                    <div className="rb-condition-stack" key={i}>
                      <button
                        className="rb-chip-remove"
                        onClick={() => removeCondition(i)}
                      >
                        ×
                      </button>
                      <select
                        value={cond.field}
                        onChange={(e) =>
                          updateCondition(i, {
                            field: e.target.value as ConditionField,
                          })
                        }
                      >
                        {Object.keys(CONDITION_FIELD_LABELS).map((cf) => (
                          <option key={cf} value={cf}>
                            {CONDITION_FIELD_LABELS[cf as ConditionField]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={cond.operator}
                        onChange={(e) =>
                          updateCondition(i, {
                            operator: e.target.value as ConditionOperator,
                          })
                        }
                      >
                        {Object.keys(CONDITION_OPERATOR_LABELS).map((op) => (
                          <option key={op} value={op}>
                            {CONDITION_OPERATOR_LABELS[op as ConditionOperator]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={cond.value}
                        onChange={(e) =>
                          updateCondition(i, { value: e.target.value })
                        }
                      />
                    </div>
                  ))}
                  <button
                    className="ps-btn-outline"
                    onClick={addCondition}
                    style={{ width: "100%" }}
                  >
                    + Add condition
                  </button>
                </div>
              </div>
            </div>

            {/* Test-on-sample-product panel */}
            <div className="ps-card" style={{ marginBottom: 20 }}>
              <div className="ps-card-label">Test before saving</div>
              <div className="ps-card-body">
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button className="ps-btn-outline" onClick={pickTestProduct}>
                    {testProduct
                      ? "Change test product"
                      : "Pick a product to test"}
                  </button>
                  {testProduct && (
                    <span style={{ fontSize: 13, color: "var(--ps-muted)" }}>
                      Testing on: {testProduct.title}
                    </span>
                  )}
                  <button
                    className="ps-btn-primary"
                    onClick={runTest}
                    disabled={
                      !testProduct ||
                      !canSave ||
                      testFetcher.state === "submitting"
                    }
                    style={{ marginLeft: "auto" }}
                  >
                    {testFetcher.state === "submitting"
                      ? "Testing…"
                      : "Run test"}
                  </button>
                </div>

                {testFetcher.data && (
                  <div className="rb-test-result">
                    {!testFetcher.data.success ? (
                      <div className="rb-test-condition-fail">
                        {testFetcher.data.error}
                      </div>
                    ) : !testFetcher.data.conditionsPass ? (
                      <div className="rb-test-condition-fail">
                        "{testFetcher.data.productTitle}" doesn't match your
                        conditions — this automation would not fire on this
                        product as configured.
                      </div>
                    ) : (
                      <>
                        <div className="rb-test-result-header">
                          Conditions passed for "{testFetcher.data.productTitle}
                          " — here's what would happen:
                        </div>
                        {testFetcher.data.steps!.map((s, i) => (
                          <div className="rb-test-step-row" key={i}>
                            <span className="rb-test-step-field">
                              {s.fieldLabel}
                            </span>
                            {s.changed ? (
                              <>
                                <span className="rb-test-step-before">
                                  {s.currentValue || "—"}
                                </span>
                                <span className="rb-test-step-after">
                                  → {s.newValue}
                                </span>
                              </>
                            ) : (
                              <span className="rb-test-step-nochange">
                                no change (already this value)
                              </span>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginBottom: 12,
              }}
            >
              {editingId && (
                <button className="rb-cancel-btn" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
              <button
                className="ps-btn-primary"
                onClick={handleSave}
                disabled={!canSave || saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create automation"}
              </button>
            </div>

            {saveError && (
              <div className="rb-locked-banner" style={{ marginBottom: 24 }}>
                <span className="rb-crown-badge">👑 Limit reached</span>
                <span className="rb-locked-text">{saveError}</span>
                <Link to="/app/plans" className="rb-upgrade-link">
                  Upgrade →
                </Link>
              </div>
            )}
          </>
        )}

        <div className="ps-section-title">Your automations</div>
        <div className="ps-card">
          {automations.length === 0 ? (
            <div className="ps-card-body">
              <p className="ps-empty" style={{ padding: 8 }}>
                No automations yet — build one above once you're on the Pro
                plan.
              </p>
            </div>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Trigger</th>
                  <th>Rules</th>
                  <th>Runs</th>
                  <th>Last run</th>
                  <th>Status</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {automations.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>
                      {a.triggerEvent === "created"
                        ? "Product created"
                        : "Product updated"}
                    </td>
                    <td>
                      {a.rules
                        .map(
                          (r: any) =>
                            `${r.action} ${r.field?.label} → ${r.value || "(toggle)"}`,
                        )
                        .join(" · ")}
                    </td>
                    <td>{a.runCount}</td>
                    <td>
                      {a.lastRunAt
                        ? new Date(a.lastRunAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      {globallyPaused ? (
                        <span className="ps-pill ps-pill-paused">
                          paused: global
                        </span>
                      ) : a.paused ? (
                        <span className="ps-pill ps-pill-paused">
                          paused: {a.pausedReason ?? "unknown"}
                        </span>
                      ) : a.active ? (
                        <span className="ps-pill ps-pill-success">Active</span>
                      ) : (
                        <span className="ps-pill ps-pill-neutral">Draft</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`ps-toggle ${a.active ? "on" : ""}`}
                        onClick={() => handleToggle(a.id)}
                        disabled={globallyPaused}
                        title={
                          globallyPaused
                            ? "Paused globally from Settings"
                            : undefined
                        }
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="ps-btn-outline"
                          onClick={() => handleEdit(a)}
                        >
                          Edit
                        </button>
                        <button
                          className="ps-btn-danger-outline"
                          onClick={() => handleDelete(a.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
