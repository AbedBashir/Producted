import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getActingUserName } from "../lib/attribution.server";
import db from "../db.server";
import { getCreditStatus, spendCredit } from "../lib/credits.server";
import { planMeetsMinimum } from "../lib/plans";
import {
  PRODUCT_FIELDS_FRAGMENT,
  conditionsMatch,
  getCurrentValue,
  computeNewValue,
  isFieldExecutable,
  applyFieldUpdate,
  fetchAllProducts,
  fetchCollectionProducts,
  type ProductNode,
} from "../lib/rule-execution";
import type { FieldOption, ActionKey, RuleCondition } from "../lib/rule-config";

interface ExecutePayload {
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
  const payload = (await request.json()) as ExecutePayload;
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

  if (!isFieldExecutable(field)) {
    return {
      success: false,
      updatedCount: 0,
      errors: [`${field.label} isn't executable yet.`],
    };
  }

  const credits = await getCreditStatus(session.shop);

  if (field.minPlan && !planMeetsMinimum(credits.plan, field.minPlan)) {
    return {
      success: false,
      updatedCount: 0,
      errors: [`${field.label} requires the ${field.minPlan} plan or higher.`],
    };
  }
  if (conditions.length > 0 && !planMeetsMinimum(credits.plan, "starter")) {
    return {
      success: false,
      updatedCount: 0,
      errors: ["Conditions require the Starter plan or higher."],
    };
  }
  if (credits.remaining <= 0) {
    return {
      success: false,
      updatedCount: 0,
      errors: [
        `Out of credits — you've used ${credits.used}/${credits.total} on the ${credits.plan} plan this month. Upgrade to keep running rules.`,
      ],
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

  let updatedCount = 0;
  const errors: string[] = [];

  for (const product of matched) {
    const currentValue = getCurrentValue(product, field);
    const newValue = computeNewValue(field, ruleAction, currentValue, value, {
      findValue,
      incrementMode,
    });
    if (currentValue === newValue) continue;

    const result = await applyFieldUpdate(admin, product, field, newValue);
    if (!result.success) {
      errors.push(`${product.title}: ${result.error}`);
      continue;
    }
    updatedCount++;
  }

  const changedProducts = matched.filter((p) => {
    const current = getCurrentValue(p, field);
    const next = computeNewValue(field, ruleAction, current, value, {
      findValue,
      incrementMode,
    });
    return current !== next;
  });

  const beforeState = changedProducts.map((p) => ({
    id: p.id,
    title: p.title,
    value: getCurrentValue(p, field),
  }));
  const afterState = changedProducts.map((p) => {
    const current = getCurrentValue(p, field);
    const next = computeNewValue(field, ruleAction, current, value, {
      findValue,
      incrementMode,
    });
    return { id: p.id, title: p.title, value: next };
  });

  await db.editHistory.create({
    data: {
      shop: session.shop,
      ruleChain: JSON.stringify({
        field,
        action: ruleAction,
        value,
        findValue,
        incrementMode,
        conditions,
      }),
      targetType,
      targetCount: updatedCount,
      status:
        errors.length === 0
          ? "completed"
          : updatedCount > 0
            ? "completed"
            : "failed",
      beforeState: JSON.stringify(beforeState),
      afterState: JSON.stringify(afterState),
      runByName: getActingUserName(session),
    },
  });

  if (updatedCount > 0) {
    await spendCredit(session.shop);
  }

  return { success: errors.length === 0, updatedCount, errors, hitCap };
};
