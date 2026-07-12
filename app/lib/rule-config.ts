import type { PlanKey } from "./plans";

export type ActionKey = "set" | "replace" | "append" | "increment" | "toggle";

export type ValueInputType =
  | "currency"
  | "text"
  | "tag-list"
  | "status-select"
  | "number"
  | "boolean-select";

export type FieldGroup = "Product fields" | "Variant fields" | "Metafields";

export interface FieldOption {
  key: string;
  label: string;
  group: FieldGroup;
  actions: ActionKey[];
  valueInputType: ValueInputType;
  metafield?: { namespace: string; key: string; type: string };
  minPlan?: PlanKey; // absent = available on Free
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  set: "Set to",
  replace: "Find & replace",
  append: "Append",
  increment: "Increase/decrease by",
  toggle: "Toggle",
};

export const STATIC_FIELDS: FieldOption[] = [
  {
    key: "title",
    label: "Title",
    group: "Product fields",
    actions: ["set", "replace"],
    valueInputType: "text",
  },
  {
    key: "vendor",
    label: "Vendor",
    group: "Product fields",
    actions: ["set", "replace"],
    valueInputType: "text",
  },
  {
    key: "productType",
    label: "Product type",
    group: "Product fields",
    actions: ["set", "replace"],
    valueInputType: "text",
  },
  {
    key: "tags",
    label: "Tags",
    group: "Product fields",
    actions: ["append", "replace", "set"],
    valueInputType: "tag-list",
  },
  {
    key: "status",
    label: "Status",
    group: "Product fields",
    actions: ["set", "toggle"],
    valueInputType: "status-select",
  },
  {
    key: "seoTitle",
    label: "SEO title",
    group: "Product fields",
    actions: ["set", "replace"],
    valueInputType: "text",
  },
  {
    key: "seoDescription",
    label: "SEO description",
    group: "Product fields",
    actions: ["set", "replace"],
    valueInputType: "text",
  },

  {
    key: "price",
    label: "Price",
    group: "Variant fields",
    actions: ["set", "increment"],
    valueInputType: "currency",
  },
  {
    key: "compareAtPrice",
    label: "Compare at price",
    group: "Variant fields",
    actions: ["set", "increment"],
    valueInputType: "currency",
  },
  {
    key: "sku",
    label: "SKU",
    group: "Variant fields",
    actions: ["set", "replace"],
    valueInputType: "text",
    minPlan: "pro",
  },
  {
    key: "barcode",
    label: "Barcode",
    group: "Variant fields",
    actions: ["set", "replace"],
    valueInputType: "text",
    minPlan: "pro",
  },
  {
    key: "weight",
    label: "Weight",
    group: "Variant fields",
    actions: ["set", "increment"],
    valueInputType: "number",
    minPlan: "pro",
  },
  {
    key: "inventoryQuantity",
    label: "Inventory quantity",
    group: "Variant fields",
    actions: ["set", "increment"],
    valueInputType: "number",
    minPlan: "pro",
  },
];

export function mapMetafieldTypeToInput(type: string): ValueInputType {
  if (type.includes("boolean")) return "boolean-select";
  if (
    type.includes("number") ||
    type.includes("decimal") ||
    type.includes("integer")
  )
    return "number";
  return "text";
}

export function metafieldToFieldOption(def: {
  namespace: string;
  key: string;
  name: string;
  type: { name: string };
}): FieldOption {
  const valueInputType = mapMetafieldTypeToInput(def.type.name);
  return {
    key: `mf:${def.namespace}:${def.key}`,
    label: def.name,
    group: "Metafields",
    actions:
      valueInputType === "boolean-select"
        ? ["set", "toggle"]
        : ["set", "replace"],
    valueInputType,
    metafield: { namespace: def.namespace, key: def.key, type: def.type.name },
    minPlan: "starter",
  };
}

export function getActionsForField(field: FieldOption): ActionKey[] {
  return field.actions;
}

export function getValueInputType(field: FieldOption): ValueInputType {
  return field.valueInputType;
}

export type ConditionField =
  "vendor" | "productType" | "tags" | "status" | "inventoryQty";
export type ConditionOperator =
  "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan";

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}
