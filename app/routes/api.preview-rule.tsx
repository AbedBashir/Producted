import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum } from "../lib/plans";
import {
  PRODUCT_FIELDS_FRAGMENT,
  conditionsMatch,
  getCurrentValue,
  computeNewValue,
  isFieldExecutable,
  fetchAllProducts,
  fetchCollectionProducts,
  type ProductNode,
} from "../lib/rule-execution";
import type { FieldOption, ActionKey, RuleCondition } from "../lib/rule-config";

interface PreviewPayload {
  field: FieldOption;
  action: ActionKey;
  value: string;
  findValue?: string;
  incrementMode?: "flat" | "percent";
  conditions: RuleCondition[];
  targetType: "all" | "products" | "collections";
  targetIds: string[];
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const payload = (await request.json()) as PreviewPayload;
  const {
    field,
    action: ruleAction,
    value,
    findValue,
    incrementMode,
    conditions,
    targetType,
    targetIds,
  } = payload;

  const credits = await getCreditStatus(session.shop);

  if (field.minPlan && !planMeetsMinimum(credits.plan, field.minPlan)) {
    return {
      totalMatched: 0,
      diffs: [],
      executable: false,
      error: `${field.label} requires the ${field.minPlan} plan or higher.`,
    };
  }
  if (conditions.length > 0 && !planMeetsMinimum(credits.plan, "starter")) {
    return {
      totalMatched: 0,
      diffs: [],
      executable: false,
      error: "Conditions require the Starter plan or higher.",
    };
  }

  const metafieldInfo = field.key.startsWith("mf:")
    ? (field.metafield ?? null)
    : null;
  const fragment = PRODUCT_FIELDS_FRAGMENT(metafieldInfo);

  let products: ProductNode[] = [];
  let hitCap = false;

  if (targetType === "products" && targetIds.length > 0) {
    const response = await admin.graphql(
      `#graphql
        query GetProductsByIds($ids: [ID!]!) {
          nodes(ids: $ids) { ... on Product { ${fragment} } }
        }`,
      { variables: { ids: targetIds } },
    );
    const data = await response.json();
    products = (data.data.nodes ?? []).filter(Boolean);
  } else if (targetType === "collections" && targetIds.length > 0) {
    const result = await fetchCollectionProducts(admin, targetIds, fragment);
    products = result.products;
    hitCap = result.hitCap;
  } else {
    const result = await fetchAllProducts(admin, fragment);
    products = result.products;
    hitCap = result.hitCap;
  }

  const matched = products.filter((p) => conditionsMatch(p, conditions));

  const diffs = matched.map((p) => {
    const currentValue = getCurrentValue(p, field);
    const newValue = computeNewValue(field, ruleAction, currentValue, value, {
      findValue,
      incrementMode,
    });
    return {
      id: p.id,
      title: p.title,
      currentValue,
      newValue,
      changed: currentValue !== newValue,
    };
  });

  return {
    totalMatched: matched.length,
    diffs: diffs.slice(0, 50),
    executable: isFieldExecutable(field),
    hitCap,
  };
};
