import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { STATIC_FIELDS } from "../lib/rule-config";

interface ParsePayload {
  command: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { command } = (await request.json()) as ParsePayload;

  if (!command?.trim()) {
    return { success: false, error: "Empty command" };
  }

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

  const fieldOptions = [
    ...STATIC_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      actions: f.actions,
    })),
    ...metafieldDefs.map((m: any) => ({
      key: `mf:${m.namespace}:${m.key}`,
      label: m.name,
      actions: ["set", "replace"],
    })),
  ];

  const systemPrompt = `You convert a merchant's plain-English bulk-edit request into structured JSON for a Shopify bulk product editor.

Available fields (use the exact "key" value):
${JSON.stringify(fieldOptions, null, 2)}

Respond with ONLY valid JSON, no markdown, no explanation, matching this exact shape:
{
  "fieldKey": "<one of the field keys above>",
  "action": "<set|replace|append|increment|toggle — must be one of the field's allowed actions>",
  "value": "<the value to apply, as a plain string>",
  "targetType": "<'all' if the request should apply to the whole store, or 'products' if it names specific product(s)>",
  "targetQuery": "<if targetType is 'products', a short search phrase matching the product title mentioned, e.g. 'Gift Card'. Omit or empty if targetType is 'all'.>",
  "confidence": "<high|medium|low>"
}

If the request is ambiguous or doesn't map to any field, set "fieldKey" to null and return only that JSON.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: command }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Claude API error: ${errText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.fieldKey) {
      return {
        success: false,
        error: "Couldn't map that to a field — try being more specific.",
      };
    }

    const matchedField = fieldOptions.find((f) => f.key === parsed.fieldKey);
    if (!matchedField) {
      return {
        success: false,
        error: "Field not recognized — try rephrasing.",
      };
    }

    // Resolve target: search real products if the AI pointed at specific ones.
    let targetType: "all" | "products" = "all";
    let targetIds: string[] = [];
    let targetLabel = "All products in store";

    if (parsed.targetType === "products" && parsed.targetQuery) {
      const searchResponse = await admin.graphql(
        `#graphql
          query SearchProducts($query: String!) {
            products(first: 10, query: $query) {
              edges { node { id title } }
            }
          }`,
        { variables: { query: `title:*${parsed.targetQuery}*` } },
      );
      const searchData = await searchResponse.json();
      const matches = searchData.data.products.edges.map((e: any) => e.node);

      if (matches.length > 0) {
        targetType = "products";
        targetIds = matches.map((m: any) => m.id);
        targetLabel =
          matches.length === 1
            ? matches[0].title
            : `${matches.length} products matching "${parsed.targetQuery}"`;
      } else {
        // No match found — fall back to "all" but flag it clearly so the user isn't surprised.
        targetType = "all";
        targetLabel = `Couldn't find a product matching "${parsed.targetQuery}" — defaulted to all products`;
      }
    }

    return {
      success: true,
      fieldKey: parsed.fieldKey,
      fieldLabel: matchedField.label,
      action: parsed.action,
      value: parsed.value,
      confidence: parsed.confidence,
      targetType,
      targetIds,
      targetLabel,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse: ${err.message ?? "unknown error"}`,
    };
  }
};
