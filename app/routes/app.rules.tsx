import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams, Link } from "react-router";
import type { loader as productsByIdsLoader } from "./api.products-by-ids";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum, PLAN_LABELS, type PlanKey } from "../lib/plans";
import "../styles/rule-builder.css";
import "../styles/shared.css";
import type { loader as collectionPreviewLoader } from "./api.collection-preview";
import type { loader as templatesLoader } from "./api.templates";
import type { loader as productsByIdsLoader } from "./api.products-by-ids";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [metafieldsResponse, countResponse, previewResponse, credits] =
    await Promise.all([
      admin.graphql(
        `#graphql
        query GetProductMetafieldDefinitions {
          metafieldDefinitions(ownerType: PRODUCT, first: 100) {
            edges { node { namespace key name type { name } } }
          }
        }`,
      ),
      admin.graphql(
        `#graphql
        query GetProductCount { productsCount { count } }`,
      ),
      admin.graphql(
        `#graphql
        query GetProductPreview {
          products(first: 6) {
            edges { node { id title featuredImage { url } } }
          }
        }`,
      ),
      getCreditStatus(session.shop),
    ]);

  const metafieldsData = await metafieldsResponse.json();
  const countData = await countResponse.json();
  const previewData = await previewResponse.json();

  const metafieldDefs = metafieldsData.data.metafieldDefinitions.edges.map(
    (e: any) => e.node,
  );
  const totalProductCount = countData.data.productsCount.count as number;
  const previewProducts = previewData.data.products.edges.map((e: any) => ({
    id: e.node.id,
    title: e.node.title,
    imageUrl: e.node.featuredImage?.url as string | undefined,
  }));

  return {
    metafieldDefs,
    totalProductCount,
    previewProducts,
    plan: credits.plan as PlanKey,
  };
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

interface PreviewItem {
  id: string;
  title: string;
  imageUrl?: string;
}

type TargetType = "all" | "products" | "collections";

interface PreviewResult {
  totalMatched: number;
  diffs: {
    id: string;
    title: string;
    currentValue: string;
    newValue: string;
    changed: boolean;
  }[];
  executable: boolean;
  error?: string;
  hitCap?: boolean;
}

interface ExecuteResult {
  success: boolean;
  updatedCount: number;
  errors: string[];
  hitCap?: boolean;
}

function ProductPreviewList({
  items,
  totalCount,
}: {
  items: PreviewItem[];
  totalCount: number;
}) {
  const shown = items.slice(0, 5);
  const ghost = items[5];
  const remaining = Math.max(totalCount - shown.length - (ghost ? 1 : 0), 0);

  if (shown.length === 0) return null;

  return (
    <div className="rb-product-list">
      {shown.map((item) => (
        <div className="rb-product-row" key={item.id}>
          {item.imageUrl ? (
            <img className="rb-product-thumb" src={item.imageUrl} alt="" />
          ) : (
            <div className="rb-product-thumb-placeholder" />
          )}
          <span className="rb-product-title">{item.title}</span>
        </div>
      ))}
      {ghost && (
        <div className="rb-product-row rb-product-ghost">
          {ghost.imageUrl ? (
            <img className="rb-product-thumb" src={ghost.imageUrl} alt="" />
          ) : (
            <div className="rb-product-thumb-placeholder" />
          )}
          <span className="rb-product-title">{ghost.title}</span>
        </div>
      )}
      {remaining > 0 && (
        <div className="rb-product-more">+{remaining} more</div>
      )}
    </div>
  );
}

export default function RuleBuilder() {
  const shopify = useAppBridge();
  const { metafieldDefs, totalProductCount, previewProducts, plan } =
    useLoaderData<typeof loader>();
  const collectionFetcher = useFetcher<typeof collectionPreviewLoader>();
  const previewFetcher = useFetcher<PreviewResult>();
  const executeFetcher = useFetcher<ExecuteResult>();
  const templatesFetcher = useFetcher<typeof templatesLoader>();
  const saveTemplateFetcher = useFetcher<{
    success: boolean;
    error?: string;
  }>();
  const productsByIdsFetcher = useFetcher<typeof productsByIdsLoader>();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"build" | "templates">("build");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");

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

  const [selectedField, setSelectedField] = useState<FieldOption>(allFields[0]);
  const [action, setAction] = useState<ActionKey>(
    getActionsForField(allFields[0])[0],
  );
  const [value, setValue] = useState("");
  const [findValue, setFindValue] = useState("");
  const [incrementMode, setIncrementMode] = useState<"flat" | "percent">(
    "flat",
  );
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [selectedItems, setSelectedItems] = useState<PreviewItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [collectionPreview, setCollectionPreview] = useState<{
    items: PreviewItem[];
    totalCount: number;
  }>({
    items: [],
    totalCount: 0,
  });

  const valueInputType = getValueInputType(selectedField);
  const availableActions = getActionsForField(selectedField);
  const conditionsLocked = !planMeetsMinimum(plan, "starter");

  const handleFieldChange = (key: string) => {
    const next = allFields.find((f) => f.key === key)!;
    if (next.minPlan && !planMeetsMinimum(plan, next.minPlan)) return;
    setSelectedField(next);
    setAction(getActionsForField(next)[0]);
    setValue("");
    setFindValue("");
    setIncrementMode("flat");
    setPreviewOpen(false);
  };

  const resetOnChange = () => setPreviewOpen(false);

  useEffect(() => {
    const fieldKey = searchParams.get("field");
    const actionParam = searchParams.get("action");
    const valueParam = searchParams.get("value");
    const targetIdsParam = searchParams.get("targetIds");

    if (fieldKey) {
      const match = allFields.find((f) => f.key === fieldKey);
      if (match && !(match.minPlan && !planMeetsMinimum(plan, match.minPlan))) {
        setSelectedField(match);
        const actions = getActionsForField(match);
        if (actionParam && actions.includes(actionParam as ActionKey)) {
          setAction(actionParam as ActionKey);
        } else {
          setAction(actions[0]);
        }
      }
    }
    if (valueParam) setValue(valueParam);

    if (targetIdsParam) {
      setTargetType("products");
      productsByIdsFetcher.load(
        `/api/products-by-ids?ids=${encodeURIComponent(targetIdsParam)}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (productsByIdsFetcher.data) {
      setSelectedItems(productsByIdsFetcher.data.items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsByIdsFetcher.data]);

  useEffect(() => {
    if (activeTab === "templates") {
      templatesFetcher.load("/api/templates");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: "vendor", operator: "equals", value: "" },
    ]);
  };
  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };
  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (targetType === "collections" && selectedItems.length > 0) {
      const ids = selectedItems.map((c) => c.id).join(",");
      collectionFetcher.load(
        `/api/collection-preview?ids=${encodeURIComponent(ids)}`,
      );
    } else if (targetType === "collections" && selectedItems.length === 0) {
      setCollectionPreview({ items: [], totalCount: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, selectedItems]);

  useEffect(() => {
    if (collectionFetcher.data) {
      setCollectionPreview({
        items: collectionFetcher.data.items,
        totalCount: collectionFetcher.data.totalCount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionFetcher.data]);

  const openResourcePicker = async () => {
    const selection = await shopify.resourcePicker({
      type: targetType === "collections" ? "collection" : "product",
      action: "select",
      multiple: true,
    });
    if (selection) {
      setSelectedItems(
        selection.map((item: any) => ({
          id: item.id,
          title: item.title,
          imageUrl: item.images?.[0]?.originalSrc ?? item.image?.originalSrc,
        })),
      );
    }
  };

  const clearSelection = () => setSelectedItems([]);

  const collectionItems = collectionPreview.items;
  const collectionProductCount = collectionPreview.totalCount;

  const targetCount =
    targetType === "all"
      ? totalProductCount
      : targetType === "collections"
        ? collectionProductCount
        : selectedItems.length;

  const previewItems =
    targetType === "all"
      ? previewProducts
      : targetType === "collections"
        ? collectionItems
        : selectedItems;

  const hasValidTarget =
    targetType === "all" ? totalProductCount > 0 : selectedItems.length > 0;

  const valueSatisfied =
    action === "toggle" ? true : action === "replace" ? !!findValue : !!value;
  const canPreview = hasValidTarget && valueSatisfied;

  const buildPayload = () => ({
    field: selectedField,
    action,
    value,
    findValue: action === "replace" ? findValue : undefined,
    incrementMode: action === "increment" ? incrementMode : undefined,
    conditions,
    targetType,
    targetIds: targetType === "all" ? [] : selectedItems.map((i) => i.id),
  });

  const runPreview = () => {
    previewFetcher.submit(JSON.stringify(buildPayload()), {
      method: "POST",
      action: "/api/preview-rule",
      encType: "application/json",
    });
    setPreviewOpen(true);
  };

  const runExecute = () => {
    executeFetcher.submit(JSON.stringify(buildPayload()), {
      method: "POST",
      action: "/api/execute-rule",
      encType: "application/json",
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    saveTemplateFetcher.submit(
      JSON.stringify({ intent: "save", name: templateName, ...buildPayload() }),
      { method: "POST", action: "/api/templates", encType: "application/json" },
    );
    setShowSaveDialog(false);
    setTemplateName("");
  };

  const loadTemplate = (template: {
    ruleChain: {
      field: FieldOption;
      action: ActionKey;
      value: string;
      findValue?: string;
      incrementMode?: "flat" | "percent";
      conditions: RuleCondition[];
    };
    targetType: string;
    targetIds: string[];
  }) => {
    const match = allFields.find((f) => f.key === template.ruleChain.field.key);
    if (match) {
      setSelectedField(match);
      setAction(template.ruleChain.action);
      setValue(template.ruleChain.value);
      setFindValue(template.ruleChain.findValue ?? "");
      setIncrementMode(template.ruleChain.incrementMode ?? "flat");
      setConditions(template.ruleChain.conditions ?? []);
      setTargetType(template.targetType as TargetType);
      if (template.targetType === "all") setSelectedItems([]);
    }
    setActiveTab("build");
  };

  const runTemplate = (templateId: string, template: any) => {
    loadTemplate(template);
    setTimeout(() => {
      templatesFetcher.submit(
        JSON.stringify({ intent: "markRun", id: templateId }),
        {
          method: "POST",
          action: "/api/templates",
          encType: "application/json",
        },
      );
    }, 100);
  };

  const valueLabel = action === "replace" ? "Replace with" : "New value";

  return (
    <div className="rb-canvas">
      <div className="rb-header">
        <div>
          <h1>Bulk edit rules</h1>
          <p>Chain a rule, aim it at products, fuse the change.</p>
        </div>
        <span className="rb-eyebrow">
          FUSIONS · Producted · {PLAN_LABELS[plan]}
        </span>
      </div>

      <div
        className="ps-tabs"
        style={{ maxWidth: 1100, margin: "0 auto 24px" }}
      >
        <button
          className={`ps-tab ${activeTab === "build" ? "active" : ""}`}
          onClick={() => setActiveTab("build")}
        >
          Build
        </button>
        <button
          className={`ps-tab ${activeTab === "templates" ? "active" : ""}`}
          onClick={() => setActiveTab("templates")}
        >
          Templates
        </button>
      </div>

      {activeTab === "build" ? (
        <>
          <div className="rb-flow">
            <div className="rb-node">
              <div className="rb-node-label">Rule</div>
              <div className="rb-node-body">
                <div className="rb-field">
                  <label>Field to edit</label>
                  <select
                    className="rb-select"
                    value={selectedField.key}
                    onChange={(e) => handleFieldChange(e.target.value)}
                  >
                    {Object.entries(groupedFields).map(([group, fields]) => (
                      <optgroup label={group} key={group}>
                        {fields.map((f) => {
                          const locked =
                            !!f.minPlan && !planMeetsMinimum(plan, f.minPlan);
                          return (
                            <option key={f.key} value={f.key} disabled={locked}>
                              {f.label}
                              {locked ? ` 👑 ${PLAN_LABELS[f.minPlan!]}` : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="rb-field">
                  <label>Action</label>
                  <select
                    className="rb-select"
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value as ActionKey);
                      resetOnChange();
                    }}
                  >
                    {availableActions.map((a) => (
                      <option key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </div>

                {action === "toggle" && (
                  <div className="rb-toggle-info">
                    {selectedField.key === "status"
                      ? "This will flip the product between Active and Draft each time it runs."
                      : "This will flip the value between True and False each time it runs."}
                  </div>
                )}

                {action === "replace" && (
                  <div className="rb-field">
                    <label>Find</label>
                    <input
                      className="rb-input"
                      type="text"
                      value={findValue}
                      onChange={(e) => {
                        setFindValue(e.target.value);
                        resetOnChange();
                      }}
                      placeholder="Text to find"
                    />
                  </div>
                )}

                {action !== "toggle" && valueInputType === "currency" && (
                  <div className="rb-field">
                    <label>
                      {action === "increment"
                        ? "Amount to increase/decrease by"
                        : valueLabel}
                    </label>
                    {action === "increment" && (
                      <div className="rb-increment-mode">
                        <button
                          type="button"
                          className={incrementMode === "flat" ? "active" : ""}
                          onClick={() => {
                            setIncrementMode("flat");
                            resetOnChange();
                          }}
                        >
                          Flat amount
                        </button>
                        <button
                          type="button"
                          className={
                            incrementMode === "percent" ? "active" : ""
                          }
                          onClick={() => {
                            setIncrementMode("percent");
                            resetOnChange();
                          }}
                        >
                          Percentage
                        </button>
                      </div>
                    )}
                    <div className="rb-input-currency">
                      <input
                        className="rb-input"
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={(e) => {
                          setValue(e.target.value);
                          resetOnChange();
                        }}
                        placeholder={
                          incrementMode === "percent" && action === "increment"
                            ? "10 (%)"
                            : "0.00"
                        }
                      />
                    </div>
                  </div>
                )}

                {action !== "toggle" && valueInputType === "number" && (
                  <div className="rb-field">
                    <label>
                      {action === "increment"
                        ? "Amount to increase/decrease by"
                        : valueLabel}
                    </label>
                    {action === "increment" && (
                      <div className="rb-increment-mode">
                        <button
                          type="button"
                          className={incrementMode === "flat" ? "active" : ""}
                          onClick={() => {
                            setIncrementMode("flat");
                            resetOnChange();
                          }}
                        >
                          Flat amount
                        </button>
                        <button
                          type="button"
                          className={
                            incrementMode === "percent" ? "active" : ""
                          }
                          onClick={() => {
                            setIncrementMode("percent");
                            resetOnChange();
                          }}
                        >
                          Percentage
                        </button>
                      </div>
                    )}
                    <input
                      className="rb-input"
                      type="number"
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        resetOnChange();
                      }}
                      placeholder={
                        incrementMode === "percent" && action === "increment"
                          ? "10 (%)"
                          : "0"
                      }
                    />
                  </div>
                )}

                {action !== "toggle" && valueInputType === "text" && (
                  <div className="rb-field">
                    <label>{valueLabel}</label>
                    <input
                      className="rb-input"
                      type="text"
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        resetOnChange();
                      }}
                    />
                  </div>
                )}

                {action !== "toggle" && valueInputType === "tag-list" && (
                  <div className="rb-field">
                    <label>
                      {action === "replace"
                        ? "Replace with"
                        : "Tags (comma separated)"}
                    </label>
                    <input
                      className="rb-input"
                      type="text"
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        resetOnChange();
                      }}
                      placeholder="summer, sale, featured"
                    />
                  </div>
                )}

                {action !== "toggle" && valueInputType === "status-select" && (
                  <div className="rb-field">
                    <label>New status</label>
                    <select
                      className="rb-select"
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        resetOnChange();
                      }}
                    >
                      <option value="">Choose status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                )}

                <div className="rb-divider" />

                {conditionsLocked ? (
                  <div className="rb-locked-banner">
                    <span className="rb-crown-badge">👑 Starter</span>
                    <span className="rb-locked-text">
                      Conditions let you target products by vendor, type, tags,
                      status, or inventory.
                    </span>
                    <Link to="/app/plans" className="rb-upgrade-link">
                      Upgrade →
                    </Link>
                  </div>
                ) : (
                  <div className="rb-field">
                    <label>Conditions (optional)</label>
                    {conditions.length === 0 && (
                      <p className="rb-conditions-empty">
                        {targetType === "all"
                          ? "Applies to all products in the store."
                          : "Applies to all selected products."}
                      </p>
                    )}
                    {conditions.map((cond, i) => (
                      <div className="rb-condition-chip" key={i}>
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
                              {
                                CONDITION_OPERATOR_LABELS[
                                  op as ConditionOperator
                                ]
                              }
                            </option>
                          ))}
                        </select>
                        <input
                          value={cond.value}
                          onChange={(e) =>
                            updateCondition(i, { value: e.target.value })
                          }
                        />
                        <button
                          className="rb-chip-remove"
                          onClick={() => removeCondition(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button className="rb-btn-ghost" onClick={addCondition}>
                      + Add condition
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rb-connector">
              <svg width="96" height="2" viewBox="0 0 96 2">
                <line x1="0" y1="1" x2="96" y2="1" className="rb-trace-line" />
                <line
                  x1="0"
                  y1="1"
                  x2="96"
                  y2="1"
                  className="rb-trace-line-animated"
                />
                <circle r="4" className="rb-pulse" />
              </svg>
            </div>

            <div className="rb-node">
              <div className="rb-node-label">Target</div>
              <div className="rb-node-body">
                <div className="rb-field">
                  <label>Apply to</label>
                  <select
                    className="rb-select"
                    value={targetType}
                    onChange={(e) => {
                      setTargetType(e.target.value as TargetType);
                      setSelectedItems([]);
                      resetOnChange();
                    }}
                  >
                    <option value="all">All products</option>
                    <option value="products">Specific products</option>
                    <option value="collections">Entire collection</option>
                  </select>
                </div>

                {targetType !== "all" && (
                  <div className="rb-target-actions">
                    <button
                      className="rb-select-products-btn"
                      onClick={openResourcePicker}
                    >
                      {targetType === "products"
                        ? "Select products"
                        : "Select collections"}
                    </button>
                    {selectedItems.length > 0 && (
                      <button className="rb-clear-btn" onClick={clearSelection}>
                        × Clear selection
                      </button>
                    )}
                  </div>
                )}

                {targetType !== "all" && (
                  <div
                    className={`rb-selection-summary ${selectedItems.length === 0 ? "rb-selection-empty" : ""}`}
                  >
                    <span className="rb-signal-dot" />
                    {selectedItems.length}{" "}
                    {targetType === "products" ? "product" : "collection"}
                    {selectedItems.length === 1 ? "" : "s"} selected
                  </div>
                )}

                {targetType === "all" && (
                  <div className="rb-selection-summary">
                    <span className="rb-signal-dot" />
                    {totalProductCount} products in store
                  </div>
                )}

                <ProductPreviewList
                  items={previewItems}
                  totalCount={targetCount}
                />
              </div>
            </div>
          </div>

          <div className="rb-preview-bar">
            <span className="rb-preview-bar-text">
              {canPreview
                ? `Ready — up to ${targetCount} target${targetCount === 1 ? "" : "s"} will be checked against your rule.`
                : "Fill in the rule to preview."}
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="rb-select-products-btn"
                style={{ width: "auto" }}
                disabled={!valueSatisfied}
                onClick={() => setShowSaveDialog(true)}
              >
                Save as template
              </button>
              <button
                className="rb-preview-btn"
                disabled={!canPreview}
                onClick={runPreview}
              >
                Preview changes
              </button>
            </div>
          </div>

          {showSaveDialog && (
            <div className="rb-preview-bar" style={{ marginTop: 12 }}>
              <input
                className="rb-input"
                placeholder="Template name, e.g. 'Black Friday price drop'"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{ maxWidth: 320 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="rb-select-products-btn"
                  style={{ width: "auto" }}
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="rb-preview-btn"
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {saveTemplateFetcher.data && !saveTemplateFetcher.data.success && (
            <div className="rb-locked-banner" style={{ marginTop: 12 }}>
              <span className="rb-crown-badge">👑 Limit reached</span>
              <span className="rb-locked-text">
                {saveTemplateFetcher.data.error}
              </span>
              <Link to="/app/plans" className="rb-upgrade-link">
                Upgrade →
              </Link>
            </div>
          )}

          {previewOpen && (
            <div style={{ maxWidth: 1100, margin: "16px auto 0" }}>
              {previewFetcher.state === "submitting" && (
                <div className="rb-preview-bar">
                  <span className="rb-preview-bar-text">
                    Checking products against your rule…
                  </span>
                </div>
              )}

              {previewFetcher.data?.error && (
                <div className="rb-locked-banner">
                  <span className="rb-crown-badge">👑 Locked</span>
                  <span className="rb-locked-text">
                    {previewFetcher.data.error}
                  </span>
                  <Link to="/app/plans" className="rb-upgrade-link">
                    Upgrade →
                  </Link>
                </div>
              )}

              {previewFetcher.data && !previewFetcher.data.error && (
                <>
                  <div className="rb-preview-bar">
                    <span className="rb-preview-bar-text">
                      {previewFetcher.data.totalMatched} product
                      {previewFetcher.data.totalMatched === 1 ? "" : "s"} match
                      — showing up to 50
                      {!previewFetcher.data.executable &&
                        " · this field isn't executable yet"}
                      {previewFetcher.data.hitCap &&
                        " · your store has more than 1,000 matching products — only the first 1,000 will be affected"}
                    </span>
                    {previewFetcher.data.executable &&
                      previewFetcher.data.totalMatched > 0 && (
                        <button
                          className="rb-preview-btn"
                          onClick={runExecute}
                          disabled={executeFetcher.state === "submitting"}
                        >
                          {executeFetcher.state === "submitting"
                            ? "Running…"
                            : `Confirm & run on ${previewFetcher.data.totalMatched}`}
                        </button>
                      )}
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      overflow: "hidden",
                      marginTop: 8,
                    }}
                  >
                    {previewFetcher.data.diffs.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: "flex",
                          gap: 16,
                          padding: "10px 16px",
                          borderBottom: "1px solid #e2e5ea",
                          fontSize: 13,
                          fontFamily: "IBM Plex Mono, monospace",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontFamily: "IBM Plex Sans, sans-serif",
                            color: "#12182b",
                          }}
                        >
                          {d.title}
                        </span>
                        <span
                          style={{
                            color: "#7c8aa5",
                            textDecoration: d.changed ? "line-through" : "none",
                          }}
                        >
                          {d.currentValue || "—"}
                        </span>
                        {d.changed && (
                          <span style={{ color: "#0d7d6f" }}>
                            → {d.newValue}
                          </span>
                        )}
                      </div>
                    ))}
                    {previewFetcher.data.diffs.length === 0 && (
                      <div className="ps-empty">
                        No products match this rule right now.
                      </div>
                    )}
                  </div>
                </>
              )}

              {executeFetcher.data && (
                <div className="rb-preview-bar" style={{ marginTop: 12 }}>
                  <span className="rb-preview-bar-text">
                    {executeFetcher.data.success
                      ? `Done — ${executeFetcher.data.updatedCount} product(s) updated.`
                      : `Updated ${executeFetcher.data.updatedCount}, ${executeFetcher.data.errors.length} error(s): ${executeFetcher.data.errors[0]}`}
                  </span>
                  <button
                    className="rb-select-products-btn"
                    style={{ width: "auto" }}
                    onClick={() => setPreviewOpen(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="ps-wrap">
          <div className="ps-card">
            <div className="ps-card-body">
              {!templatesFetcher.data && (
                <p className="ps-empty">Loading templates…</p>
              )}
              {templatesFetcher.data?.templates.length === 0 && (
                <p className="ps-empty">
                  No saved templates yet — build a rule and click "Save as
                  template" to create one.
                </p>
              )}
              {templatesFetcher.data?.templates.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--ps-border, #e2e5ea)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#7c8aa5" }}>
                      {t.description}
                      {t.lastRunAt &&
                        ` · last run ${new Date(t.lastRunAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="ps-btn-outline"
                      onClick={() => loadTemplate(t as any)}
                    >
                      Edit
                    </button>
                    <button
                      className="ps-btn-dark"
                      onClick={() => runTemplate(t.id, t)}
                    >
                      Load & Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
