import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  PRODUCT_FIELDS_FRAGMENT,
  conditionsMatch,
  getCurrentValue,
  computeNewValue,
  type ProductNode,
} from "../lib/rule-execution";
import type { FieldOption, ActionKey, RuleCondition } from "../lib/rule-config";

interface RuleStep {
  field: FieldOption;
  action: ActionKey;
  value: string;
  findValue?: string;
  incrementMode?: "flat" | "percent";
}

interface PreviewAutomationPayload {
  productId: string;
  rules: RuleStep[];
  conditions: RuleCondition[];
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { productId, rules, conditions } =
    (await request.json()) as PreviewAutomationPayload;

  if (!productId) {
    return { success: false, error: "Pick a product to test against first." };
  }

  const metafieldStep = rules.find((r) => r.field.key.startsWith("mf:"));
  const fragment = PRODUCT_FIELDS_FRAGMENT(
    metafieldStep?.field.metafield ?? null,
  );

  const response = await admin.graphql(
    `#graphql
      query GetProductForAutomationPreview($id: ID!) {
        product(id: $id) { ${fragment} }
      }`,
    { variables: { id: productId } },
  );
  const data = await response.json();
  const product = data.data?.product as ProductNode | null;

  if (!product) {
    return { success: false, error: "Couldn't find that product." };
  }

  const conditionsPass = conditionsMatch(product, conditions);

  const stepResults = rules.map((step) => {
    const currentValue = getCurrentValue(product, step.field);
    const newValue = computeNewValue(
      step.field,
      step.action,
      currentValue,
      step.value,
      {
        findValue: step.findValue,
        incrementMode: step.incrementMode,
      },
    );
    return {
      fieldLabel: step.field.label,
      currentValue,
      newValue,
      changed: currentValue !== newValue,
    };
  });

  return {
    success: true,
    productTitle: product.title,
    conditionsPass,
    steps: stepResults,
  };
};
